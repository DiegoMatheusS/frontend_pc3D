export { mountedPcsMock } from './mountedPcsMock'

export const offerGroupsMock = [
  {
    id: 'hardwares',
    label: 'Hardwares',
    description: 'Processadores, placas de vídeo, memória, armazenamento e outros componentes.',
    products: [
      { id: 101, name: 'AMD Ryzen 7 7800X3D', brand: 'AMD', price: 2499, previousPrice: 2799, offersCount: 4, category: 'Processador' },
      { id: 102, name: 'GeForce RTX 5070 12 GB', brand: 'NVIDIA', price: 4399, previousPrice: 4699, offersCount: 3, category: 'Placa de vídeo' },
      { id: 103, name: 'SSD NVMe 1 TB PCIe 4.0', brand: 'Kingston', price: 419, previousPrice: 469, offersCount: 6, category: 'Armazenamento' },
    ],
  },
  {
    id: 'perifericos',
    label: 'Periféricos',
    description: 'Mouse, teclado, headset e acessórios para completar o uso do computador.',
    products: [
      { id: 201, name: 'Mouse Gamer G502', brand: 'Logitech', price: 249, previousPrice: 299, offersCount: 5, category: 'Mouse' },
      { id: 202, name: 'Teclado Mecânico Kumara', brand: 'Redragon', price: 219, previousPrice: 259, offersCount: 4, category: 'Teclado' },
      { id: 203, name: 'Teclado Mecânico K70', brand: 'Corsair', price: 699, previousPrice: 799, offersCount: 3, category: 'Teclado' },
    ],
  },
  {
    id: 'monitores',
    label: 'Monitores',
    description: 'Opções para jogos, produtividade e criação, separadas do restante do catálogo.',
    products: [
      { id: 301, name: 'Monitor UltraGear 27” 180 Hz', brand: 'LG', price: 1399, previousPrice: 1599, offersCount: 4, category: 'Monitor' },
      { id: 302, name: 'Monitor Odyssey 27” 165 Hz', brand: 'Samsung', price: 1499, previousPrice: 1699, offersCount: 3, category: 'Monitor' },
      { id: 303, name: 'Monitor 24” 144 Hz', brand: 'AOC', price: 899, previousPrice: 999, offersCount: 5, category: 'Monitor' },
    ],
  },
]
