export const STORE_GROUP_LABELS = {
  hardwares: 'Peças para PC',
  computadores: 'Computadores',
  celulares: 'Celulares',
  tablets: 'Tablets',
  notebooks: 'Notebooks',
  monitores: 'Monitores',
  perifericos: 'Periféricos',
  games: 'Games',
  'tv-audio': 'TV e Áudio',
  fotografia: 'Foto e Vídeo',
  'casa-inteligente': 'Casa Inteligente',
  eletroportateis: 'Eletroportáteis',
  rede: 'Rede e Internet',
  impressao: 'Impressão',
  wearables: 'Wearables',
  maker: 'Eletrônica e Maker',
  acessorios: 'Acessórios',
  setup: 'Setup',
}

export const STORE_SECTION_LABELS = {
  computadores: 'Computadores',
  mobilidade: 'Celulares e mobilidade',
  games: 'Games',
  'tv-audio-foto-video': 'TV, áudio, foto e vídeo',
  'casa-inteligente': 'Casa inteligente',
  eletroportateis: 'Eletroportáteis',
  'rede-impressao-maker': 'Rede, impressão e maker',
  'acessorios-ofertas': 'Acessórios e ofertas',
}


export const STORE_MENU_SECTIONS = [
  {
    id: 'computadores',
    title: 'Computadores',
    links: [
      ['Todos os produtos', '/loja'],
      ['Peças para PC', '/pecas'],
      ['Notebooks', '/notebooks'],
      ['Mini computadores', '/loja?categoria=mini-computadores'],
      ['Monitores', '/loja?grupo=monitores'],
    ],
  },
  {
    id: 'mobilidade',
    title: 'Celulares e mobilidade',
    links: [
      ['Celulares', '/loja?categoria=celulares'],
      ['Tablets', '/loja?categoria=tablets'],
      ['Smartwatches', '/loja?categoria=relogios-inteligentes'],
      ['E-readers', '/loja?categoria=e-readers'],
      ['Power banks', '/loja?categoria=power-banks'],
    ],
  },
  {
    id: 'games',
    title: 'Games',
    links: [
      ['Videogames e consoles', '/loja?categoria=videogames-consoles'],
      ['Jogos', '/loja?categoria=jogos'],
      ['Controles', '/loja?categoria=controles-videogame'],
      ['Joysticks', '/loja?categoria=joysticks'],
      ['Volantes', '/loja?categoria=volantes'],
    ],
  },
  {
    id: 'tv-audio-foto-video',
    title: 'TV, áudio, foto e vídeo',
    links: [
      ['Smart TVs', '/loja?categoria=smart-tvs'],
      ['Projetores', '/loja?categoria=projetores'],
      ['Câmeras e fotografia', '/loja?categoria=cameras'],
      ['Câmeras de ação', '/loja?categoria=cameras-de-acao'],
      ['Drones', '/loja?categoria=drones'],
      ['Caixas de som', '/loja?categoria=caixas-de-som'],
      ['Soundbars', '/loja?categoria=soundbars'],
      ['Home theaters', '/loja?categoria=home-theaters'],
    ],
  },
  {
    id: 'casa-inteligente',
    title: 'Casa inteligente',
    links: [
      ['Robôs aspiradores', '/loja?categoria=robos-aspiradores'],
      ['Aspiradores de pó', '/loja?categoria=aspiradores-de-po'],
      ['Smart speakers', '/loja?categoria=smart-speakers'],
      ['Câmeras de segurança', '/loja?categoria=cameras-de-seguranca'],
      ['Lâmpadas inteligentes', '/loja?categoria=lampadas-inteligentes'],
      ['Tomadas inteligentes', '/loja?categoria=tomadas-inteligentes'],
      ['Fechaduras inteligentes', '/loja?categoria=fechaduras-inteligentes'],
    ],
  },
  {
    id: 'eletroportateis',
    title: 'Eletroportáteis',
    links: [
      ['Air fryers', '/loja?categoria=air-fryers'],
      ['Cafeteiras', '/loja?categoria=cafeteiras'],
      ['Liquidificadores', '/loja?categoria=liquidificadores'],
      ['Ventiladores', '/loja?categoria=ventiladores'],
      ['Climatizadores', '/loja?categoria=climatizadores'],
    ],
  },
  {
    id: 'rede-impressao-maker',
    title: 'Rede, impressão e maker',
    links: [
      ['Roteadores', '/loja?categoria=roteadores'],
      ['Repetidores Wi-Fi', '/loja?categoria=repetidores-wifi'],
      ['Switches de rede', '/loja?categoria=switches-de-rede'],
      ['Impressoras e scanners', '/loja?grupo=impressao'],
      ['Impressoras 3D', '/loja?categoria=impressoras-3d'],
      ['Arduino e robótica', '/loja?categoria=kits-arduino-robotica'],
    ],
  },
  {
    id: 'acessorios-ofertas',
    title: 'Acessórios e ofertas',
    links: [
      ['Carregadores', '/loja?categoria=carregadores'],
      ['Cabos e adaptadores', '/loja?categoria=cabos-adaptadores'],
      ['Hubs e docks', '/loja?grupo=acessorios'],
      ['Armazenamento externo', '/loja?categoria=armazenamento-externo'],
      ['Periféricos', '/loja?grupo=perifericos'],
      ['Setup', '/loja?grupo=setup'],
      ['Ofertas', '/ofertas'],
    ],
  },
]


// Os nomes dos tópicos existem mesmo quando a categoria ainda não tem produtos.
export const STORE_CATEGORY_LABELS = Object.fromEntries(
  STORE_MENU_SECTIONS.flatMap((section) => section.links.flatMap(([label, href]) => {
    const category = new URL(href, 'https://criabyte.com.br').searchParams.get('categoria')
    return category ? [[category, label]] : []
  })),
)
