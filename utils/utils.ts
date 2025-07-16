
export const GenerateRandomString = (length: number): string => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};



export function generateCode(): string {
    // Function to generate a random number between min (inclusive) and max (inclusive)
    function getRandomNumber(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Generate 5 random numbers
    let randomNumbers = '';
    for (let i = 0; i < 5; i++) {
        randomNumbers += getRandomNumber(0, 9).toString();
    }

    // Generate a random alphabet letter
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const randomLetter = alphabet.charAt(
        getRandomNumber(0, alphabet.length - 1),
    );

    // Concatenate the numbers and the letter
    const randomString = randomNumbers + randomLetter;

    return randomString;
}