// Roteiro do jogo. Cada cena tem texto e escolhas.
// Uma escolha pode: mudar saldo/paciência (effects), marcar algo (flags), mostrar um resultado (result)
// e/ou abrir um minigame (minigame). Depois vai para a cena "next".

export const START_SALDO = 1400;
export const START_PACIENCIA = 80;

export const SCENES = {
  intro: {
    place: 'Chegada a Nova Aurora',
    seed: 3,
    mood: 0,
    text: [
      'Seu Antônio tem 72 anos. Foi metalúrgico por 35 anos e se aposentou com R$ 1.400 por mês.',
      'Hoje ele chega a Nova Aurora, a cidade mais tecnológica do país, para o aniversário da neta, Júlia.',
      'Ela mandou o endereço por mensagem... numa tal de "localização em tempo real" que ele não sabe abrir.',
    ],
    choices: [{ label: 'Começar a jornada', next: 'rodoviaria' }],
  },

  rodoviaria: {
    place: 'Rodoviária Central',
    seed: 7,
    mood: 0,
    text: [
      'Na rodoviária não existe guichê. Só totens brilhantes, cheios de propaganda.',
      'Ele precisa de um bilhete de metrô para chegar ao bairro da Júlia.',
    ],
    choices: [
      { label: 'Encarar o totem de autoatendimento', minigame: 'kiosk', next: 'farmacia' },
      {
        label: 'Procurar um atendente humano',
        effects: { saldo: -21, paciencia: -12 },
        result: 'O único atendente fica numa sala de "Atendimento Assistido". Taxa: R$ 15, mais o bilhete. "Antigamente isso era de graça", resmunga Antônio.',
        next: 'farmacia',
      },
      {
        label: 'Pedir ajuda a um jovem',
        effects: { saldo: -6, paciencia: 6 },
        flags: ['ajudado'],
        result: 'Um rapaz de fone de ouvido para, compra o bilhete em dez segundos e ainda mostra o caminho. "Nem todo jovem é apressado", pensa Antônio.',
        next: 'farmacia',
      },
    ],
  },

  farmacia: {
    place: 'Farmácia Automática',
    seed: 11,
    mood: -1,
    text: [
      'No caminho, ele lembra: o remédio da pressão acabou. Custa R$ 84,90.',
      'Na porta, uma placa: "NÃO ACEITAMOS DINHEIRO. SOMENTE PIX."',
    ],
    choices: [
      { label: 'Pagar com o app do banco', minigame: 'pix', next: 'praca' },
      {
        label: 'Pedir para passar no cartão',
        effects: { saldo: -94.9, paciencia: -15 },
        result: 'O "funcionário" é um robô que repete: "Use o Pix, cidadão." Uma cliente paga por ele, e Antônio devolve em dinheiro, com R$ 10 a mais de agradecimento.',
        next: 'praca',
      },
      {
        label: 'Ligar para a Júlia pedir ajuda',
        effects: { paciencia: -18 },
        flags: ['semRemedio'],
        result: 'Caixa postal. Júlia está em aula. Antônio desiste do remédio por hoje.',
        next: 'praca',
      },
    ],
  },

  praca: {
    place: 'Praça da Inovação',
    seed: 19,
    mood: 0,
    text: [
      'Meio-dia, e a fome aperta. O restaurante da praça não tem cardápio na mesa.',
      'Só uma plaquinha: "Escaneie o QR code para ver o cardápio".',
    ],
    choices: [
      { label: 'Tentar ler o QR code com o celular', minigame: 'qr', next: 'portaria' },
      {
        label: 'Perguntar se tem cardápio de papel',
        effects: { saldo: -28, paciencia: 10 },
        flags: ['gentileza'],
        result: 'A garçonete sorri: "Tem sim, seu Antônio. Eu guardo um pra quem precisa." Prato feito por R$ 28. A comida tem gosto de casa.',
        next: 'portaria',
      },
      {
        label: 'Comer um salgado da máquina',
        effects: { saldo: -12, paciencia: -10 },
        result: 'A máquina só aceita aproximação. Depois de três tentativas, cai uma coxinha fria. R$ 12.',
        next: 'portaria',
      },
    ],
  },

  portaria: {
    place: 'Prédio da Júlia',
    seed: 23,
    mood: 0,
    text: [
      'Finalmente, o prédio da Júlia. Não há porteiro, só um alto-falante na parede.',
      '"Olá! Eu sou a AURA, sua assistente. Como posso ajudar?"',
    ],
    choices: [
      { label: 'Falar com a AURA', minigame: 'voice', next: 'final' },
      {
        label: 'Esperar alguém abrir a porta',
        effects: { paciencia: -25 },
        result: 'Quarenta e cinco minutos depois, um entregador de drone abre a porta. Antônio sobe, cansado e atrasado.',
        next: 'final',
      },
    ],
  },
};

// Finais. A ordem importa: o primeiro que bater é o escolhido.
export const ENDINGS = [
  {
    id: 'perdido',
    test: (s) => s.paciencia <= 0,
    title: 'Perdido no tempo',
    mood: -1,
    text: [
      'Antônio senta num banco da praça. Não tem mais forças para lutar com telas, senhas e códigos.',
      'À noite, Júlia o encontra ali. Ele não perdeu o caminho: foi a cidade que andou rápido demais e esqueceu de esperar.',
    ],
    reflection: 'Tecnologia que não pensa em todo mundo também exclui. Quem você conhece que passa por isso?',
  },
  {
    id: 'golpe',
    test: (s) => s.flags.has('golpe'),
    title: 'O preço da pressa',
    mood: -1,
    text: [
      'Antônio chega à festa, mas o celular vibra: o dinheiro foi para um golpista.',
      'Júlia o ajuda a registrar o boletim de ocorrência e a avisar o banco. Na semana seguinte, ele vira voluntário num grupo que ensina outros idosos a desconfiar de mensagens "urgentes".',
    ],
    reflection: 'Golpes digitais miram quem tem menos familiaridade com tecnologia. Informação e paciência são a melhor proteção.',
  },
  {
    id: 'conectado',
    test: (s) => s.saldo >= 1200 && s.paciencia >= 55,
    title: 'Uma cidade para todos',
    mood: 1,
    text: [
      'Antônio chega na hora do parabéns. Conta as aventuras do dia e todo mundo ri, inclusive ele.',
      'No fim da festa, ele e Júlia escrevem para a prefeitura propondo "botões gentis": telas com letras grandes, tempo extra e sempre uma pessoa para ajudar.',
    ],
    reflection: 'A tecnologia pode aproximar as gerações quando é feita com paciência e para todo mundo.',
  },
  {
    id: 'sobrevivente',
    test: () => true,
    title: 'Chegou, mas a que preço',
    mood: 0,
    text: [
      'Antônio chega atrasado, cansado e com a carteira mais leve. Júlia o abraça forte.',
      '"Vô, amanhã eu te ensino tudo com calma." Ele sorri: "E quem vai ensinar a cidade a ter calma comigo?"',
    ],
    reflection: 'Aprender é possível em qualquer idade, mas a responsabilidade de incluir também é de quem cria a tecnologia.',
  },
];

export function pickEnding(state) {
  return ENDINGS.find((e) => e.test(state));
}
