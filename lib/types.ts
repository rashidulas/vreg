export interface CarDetails {
  make: string;
  model: string;
  year: string;
  licensePlate: string;
  aptNumber: string;
  email: string;
}

export interface Property {
  id: string;
  name: string;
  urlKey: string;
  address?: string;
  aptNumber: string;
}

export interface RegistrationResult {
  success: boolean;
  message: string;
  property: string;
  timestamp: string;
  confirmationCode?: string;
}
