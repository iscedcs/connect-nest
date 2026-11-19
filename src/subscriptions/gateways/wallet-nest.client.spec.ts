import {
  BadGatewayException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { WalletNestClient } from './wallet-nest.client';

describe('WalletNestClient', () => {
  const env = { ...process.env };
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  let client: WalletNestClient;

  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

  beforeEach(() => {
    process.env.WALLET_API_URL = 'http://wallet-nest:3334/';
    process.env.INTERNAL_API_KEY = 'internal-test-key';
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
    client = new WalletNestClient();
  });

  afterEach(() => {
    process.env = { ...env };
    global.fetch = realFetch;
  });

  it('charges a saved card as Connect, with the internal secret', async () => {
    respond(200, {
      success: true,
      data: {
        status: 'success',
        reference: 'SUBR_1',
        gatewayResponse: 'Approved',
      },
    });

    await expect(
      client.chargeSavedCard('card/1', {
        userId: 'usr_1',
        amountKobo: 100000,
        reference: 'SUBR_1',
        metadata: { checkoutKind: 'renewal' },
      }),
    ).resolves.toEqual({
      status: 'success',
      reference: 'SUBR_1',
      reason: 'Approved',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'http://wallet-nest:3334/api/internal/paystack/saved-cards/card%2F1/charge',
    );
    expect(init.headers['X-Internal-Secret']).toBe('internal-test-key');
    expect(JSON.parse(init.body)).toEqual({
      service: 'connect',
      ownerRef: 'usr_1',
      amountKobo: 100000,
      reference: 'SUBR_1',
      metadata: { checkoutKind: 'renewal' },
    });
  });

  it('reports a card or permission that is gone as not found', async () => {
    respond(404, { message: 'No active permission to charge this wallet' });
    await expect(
      client.revokeMandate('mandate_1', 'usr_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes a refusal the user can act on through with its status', async () => {
    respond(400, { message: ['Amount is more than', 'the user allowed'] });
    const err = await client
      .chargeMandate({
        mandateId: 'm_1',
        userId: 'usr_1',
        amountKobo: 1,
        reference: 'r',
        description: 'd',
        metadata: {},
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(400);
    expect(err.message).toBe('Amount is more than. the user allowed');
  });

  it('turns any other failure into a 502', async () => {
    respond(401, { message: 'Invalid internal secret' });
    await expect(
      client.removeSavedCard('card_1', 'usr_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      client.removeSavedCard('card_1', 'usr_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('refuses to call out when it is not configured', async () => {
    delete process.env.WALLET_API_URL;
    await expect(
      client.removeSavedCard('card_1', 'usr_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('labels a card by brand and last four digits', () => {
    expect(WalletNestClient.cardLabel({ brand: 'visa', last4: '4081' })).toBe(
      'visa •••• 4081',
    );
    expect(WalletNestClient.cardLabel({ brand: null, last4: '4081' })).toBe(
      'card •••• 4081',
    );
  });
});
