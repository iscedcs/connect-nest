/**
 * Get the vehicle category fee based on the vehicle category.
 *
 * @param category - The category of the vehicle
 * @returns The fee associated with the vehicle category
 */
export const getVehicleCategoryFee = (category: string): number => {
  switch (category) {
    case 'TRICYCLE':
      return 333;
    case 'SHUTTLE_BUS':
      return 400;
    case 'BUS_INTRASTATE':
      return 500;
    case 'TRUCKS':
      return 500;
    case 'BUS_INTERSTATE':
      return 666;
    default:
      return 666; // Default fee for OTHERS category
  }
};
