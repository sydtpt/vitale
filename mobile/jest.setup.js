// Mock nativo do AsyncStorage para os testes (provido pelo próprio pacote).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
