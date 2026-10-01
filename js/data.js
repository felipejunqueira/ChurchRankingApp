/**
 * ─────────────────────────────────────────────────────────────
 * 1. BANCO DE PERGUNTAS E PONTUAÇÕES OFICIAIS (100% PRESERVADAS)
 * ─────────────────────────────────────────────────────────────
 */
const questions = [
  { category: "Liderança",       text: "Dirigir a Escola Sabatina",                                        value: 150 },
  { category: "Missão Especial", text: "Levar Visitas NÃO ADVENTISTAS (por pessoa)",                       value: 110 },
  { category: "Estudo Diário",   text: "Passar a Lição da Escola Sabatina",                                value: 105 },
  { category: "Estudo Profundo", text: "Resumo Manuscrito do Livro + Explicação Oral",                     value: 100, note: "90 pts resumo + 10 pts explicação oral" },
  { category: "Iniciativa",      text: "Trazer Inovações para a sala",                                     value: 100 },
  { category: "Missão",          text: "Ser instrutor bíblico",                                            value: 90  },
  { category: "Competição",      text: "Ter ficado em primeiro lugar no quiz",                             value: 75  },
  { category: "Engajamento",     text: "Participação Ativa nas Redes Sociais da Escola Sabatina (aparecer, falar, curtir, comentar, compartilhar)", value: 65 },
  { category: "Serviço",         text: "Trabalho Missionário na semana",                                   value: 65  },
  { category: "Comunidade",      text: "Participar de Pequenos Grupos",                                    value: 65, note: "por semana" },
  { category: "Assiduidade",     text: "Preencher os apontamentos no app 7me",                             value: 60, note: "por semana" },
  { category: "Generosidade",    text: "Oferta Caixa dos Adolescentes (5 reais por sábado)",               value: 60  },
  { category: "Mordomia",        text: "Oferta Escola Sabatina",                                           value: 60  },
  { category: "Pontualidade",    text: "Chegar no horário (até as 08:59h)",                                value: 50  },
  { category: "Zelo",            text: "Arrumar a sala / cuidar da lousa",                                 value: 45  },
  { category: "Espiritualidade", text: "Passar a Carta Missionária",                                       value: 40  },
  { category: "Missão real",     text: "Orar em Público",                                                  value: 20  },
  { category: "Compromisso",     text: "Ter assinatura da lição da escola sabatina",                       value: 5,  note: "por sábado" },
];

/**
 * ─────────────────────────────────────────────────────────────
 * 2. LISTA OFICIAL DE ADOLESCENTES PRÉ-CADASTRADOS (SEM DIGITAÇÃO)
 * ─────────────────────────────────────────────────────────────
 */
const REGISTERED_TEENS = [
  { name: "Jonas",           initial: "JO", rank: "1º" },
  { name: "Luiza",           initial: "LU", rank: "2º" },
  { name: "Isac",            initial: "IS", rank: "3º" },
  { name: "Vítor Soares",    initial: "VS", rank: "4º" },
  { name: "Gabriel Santana", initial: "GS", rank: "5º" },
  { name: "Josué",           initial: "JS", rank: "6º" },
  { name: "Izaque",          initial: "IZ", rank: "7º" },
  { name: "Moisés",          initial: "MO", rank: "8º" },
  { name: "Isaías",          initial: "IA", rank: "9º" },
  { name: "Alex",            initial: "AL", rank: "10º" },
  { name: "Nycolas",         initial: "NY", rank: "11º" },
  { name: "Arthur",          initial: "AR", rank: "12º" },
  { name: "Juan",            initial: "JU", rank: "13º" },
  { name: "Nicholas",        initial: "NI", rank: "14º" }
];

/**
 * ─────────────────────────────────────────────────────────────
 * 3. HISTÓRICO OFICIAL COM DATAS MAPEADAS DOS SÁBADOS DE 2026
 * ─────────────────────────────────────────────────────────────
 */
const OFFICIAL_SEED_RECORDS = [
  // ─── SÁBADO 26/09/2026 ───
  { id: 'rec_2609_jonas',   name: 'Jonas',           date: '2026-09-26', total: 390, answers: [] },
  { id: 'rec_2609_isac',    name: 'Isac',            date: '2026-09-26', total: 160, answers: [] },

  // ─── SÁBADO 19/09/2026 ───
  { id: 'rec_1909_jonas',   name: 'Jonas',           date: '2026-09-19', total: 465, answers: [] },

  // ─── SÁBADO 29/08/2026 ───
  { id: 'rec_2908_jonas',   name: 'Jonas',           date: '2026-08-29', total: 355, answers: [] },

  // ─── SÁBADO 22/08/2026 ───
  { id: 'rec_2208_jonas',   name: 'Jonas',           date: '2026-08-22', total: 290, answers: [] },

  // ─── SÁBADO 27/06/2026 ───
  { id: 'rec_2706_jonas',   name: 'Jonas',           date: '2026-06-27', total: 225, answers: [] },
  { id: 'rec_2706_luiza',   name: 'Luiza',           date: '2026-06-27', total: 135, answers: [] },

  // ─── SÁBADO 13/06/2026 ───
  { id: 'rec_1306_luiza',   name: 'Luiza',           date: '2026-06-13', total: 135, answers: [] },

  // ─── SÁBADO 06/06/2026 ───
  { id: 'rec_0606_luiza',   name: 'Luiza',           date: '2026-06-06', total: 135, answers: [] },

  // ─── SÁBADO 30/05/2026 ───
  { id: 'rec_3005_jonas',   name: 'Jonas',           date: '2026-05-30', total: 330, answers: [] },
  { id: 'rec_3005_luiza',   name: 'Luiza',           date: '2026-05-30', total: 295, answers: [] },
  { id: 'rec_3005_isac',    name: 'Isac',            date: '2026-05-30', total: 225, answers: [] },

  // ─── SÁBADO 16/05/2026 ───
  { id: 'rec_1605_jonas',   name: 'Jonas',           date: '2026-05-16', total: 330, answers: [] },
  { id: 'rec_1605_vitor',   name: 'Vítor Soares',    date: '2026-05-16', total: 130, answers: [] },

  // ─── SÁBADO 09/05/2026 ───
  { id: 'rec_0905_isac',    name: 'Isac',            date: '2026-05-09', total: 185, answers: [] },

  // ─── SÁBADO 02/05/2026 ───
  { id: 'rec_0205_jonas',   name: 'Jonas',           date: '2026-05-02', total: 350, answers: [] },
  { id: 'rec_0205_luiza',   name: 'Luiza',           date: '2026-05-02', total: 305, answers: [] },
  { id: 'rec_0205_vitor',   name: 'Vítor Soares',    date: '2026-05-02', total: 200, answers: [] },
  { id: 'rec_0205_isac',    name: 'Isac',            date: '2026-05-02', total: 110, answers: [] },

  // ─── SÁBADO 25/04/2026 ───
  { id: 'rec_2504_jonas',   name: 'Jonas',           date: '2026-04-25', total: 330, answers: [] },
  { id: 'rec_2504_vitor',   name: 'Vítor Soares',    date: '2026-04-25', total: 245, answers: [] },
  { id: 'rec_2504_luiza',   name: 'Luiza',           date: '2026-04-25', total: 155, answers: [] },
  { id: 'rec_2504_isac',    name: 'Isac',            date: '2026-04-25', total: 105, answers: [] },

  // ─── SÁBADO 18/04/2026 ───
  { id: 'rec_1804_isac',    name: 'Isac',            date: '2026-04-18', total: 110, answers: [] },

  // ─── SÁBADO 11/04/2026 ───
  { id: 'rec_1104_luiza',   name: 'Luiza',           date: '2026-04-11', total: 285, answers: [] },

  // ─── SÁBADO 04/04/2026 ───
  { id: 'rec_0404_luiza',   name: 'Luiza',           date: '2026-04-04', total: 270, answers: [] },

  // ─── SÁBADO 28/03/2026 ───
  { id: 'rec_2803_isac',    name: 'Isac',            date: '2026-03-28', total: 310, answers: [] },
  { id: 'rec_2803_vitor',   name: 'Vítor Soares',    date: '2026-03-28', total: 175, answers: [] },

  // ─── SÁBADO 21/03/2026 ───
  { id: 'rec_2103_luiza',   name: 'Luiza',           date: '2026-03-21', total: 85,  answers: [] },

  // ─── SÁBADO 14/03/2026 ───
  { id: 'rec_1403_gabriel', name: 'Gabriel Santana', date: '2026-03-14', total: 255, answers: [] },
  { id: 'rec_1403_vitor',   name: 'Vítor Soares',    date: '2026-03-14', total: 200, answers: [] },
  { id: 'rec_1403_jonas',   name: 'Jonas',           date: '2026-03-14', total: 185, answers: [] },
  { id: 'rec_1403_josue',   name: 'Josué',           date: '2026-03-14', total: 180, answers: [] },
  { id: 'rec_1403_luiza',   name: 'Luiza',           date: '2026-03-14', total: 115, answers: [] },
  { id: 'rec_1403_isac',    name: 'Isac',            date: '2026-03-14', total: 110, answers: [] },

  // ─── SÁBADO 07/03/2026 ───
  { id: 'rec_0703_vitor',   name: 'Vítor Soares',    date: '2026-03-07', total: 335, answers: [] },
  { id: 'rec_0703_isaias',  name: 'Isaías',          date: '2026-03-07', total: 285, answers: [] },
  { id: 'rec_0703_luiza',   name: 'Luiza',           date: '2026-03-07', total: 270, answers: [] },
  { id: 'rec_0703_gabriel', name: 'Gabriel Santana', date: '2026-03-07', total: 160, answers: [] },
  { id: 'rec_0703_isac',    name: 'Isac',            date: '2026-03-07', total: 130, answers: [] },
  { id: 'rec_0703_moises',  name: 'Moisés',          date: '2026-03-07', total: 115, answers: [] },

  // ─── SÁBADO 28/02/2026 ───
  { id: 'rec_2802_luiza',   name: 'Luiza',           date: '2026-02-28', total: 470, answers: [] },
  { id: 'rec_2802_vitor',   name: 'Vítor Soares',    date: '2026-02-28', total: 335, answers: [] },
  { id: 'rec_2802_josue',   name: 'Josué',           date: '2026-02-28', total: 290, answers: [] },
  { id: 'rec_2802_jonas',   name: 'Jonas',           date: '2026-02-28', total: 240, answers: [] },
  { id: 'rec_2802_isac',    name: 'Isac',            date: '2026-02-28', total: 130, answers: [] },

  // ─── SÁBADO 21/02/2026 ───
  { id: 'rec_2102_vitor',   name: 'Vítor Soares',    date: '2026-02-21', total: 280, answers: [] },
  { id: 'rec_2102_alex',    name: 'Alex',            date: '2026-02-21', total: 200, answers: [] },
  { id: 'rec_2102_izaque',  name: 'Izaque',          date: '2026-02-21', total: 180, answers: [] },
  { id: 'rec_2102_jonas',   name: 'Jonas',           date: '2026-02-21', total: 135, answers: [] },
  { id: 'rec_2102_isac',    name: 'Isac',            date: '2026-02-21', total: 130, answers: [] },
  { id: 'rec_2102_gabriel', name: 'Gabriel Santana', date: '2026-02-21', total: 115, answers: [] },
  { id: 'rec_2102_moises',  name: 'Moisés',          date: '2026-02-21', total: 70,  answers: [] },
  { id: 'rec_2102_nycolas', name: 'Nycolas',         date: '2026-02-21', total: 65,  answers: [] },
  { id: 'rec_2102_luiza',   name: 'Luiza',           date: '2026-02-21', total: 60,  answers: [] },
  { id: 'rec_2102_josue',   name: 'Josué',           date: '2026-02-21', total: 28,  answers: [] },

  // ─── SÁBADO 07/02/2026 ───
  { id: 'rec_0702_isac',    name: 'Isac',            date: '2026-02-07', total: 130, answers: [] },

  // ─── SÁBADO 31/01/2026 ───
  { id: 'rec_3101_izaque',  name: 'Izaque',          date: '2026-01-31', total: 175, answers: [] },
  { id: 'rec_3101_isac',    name: 'Isac',            date: '2026-01-31', total: 150, answers: [] },
  { id: 'rec_3101_moises',  name: 'Moisés',          date: '2026-01-31', total: 100, answers: [] },
  { id: 'rec_3101_vitor',   name: 'Vítor Soares',    date: '2026-01-31', total: 70,  answers: [] },
  { id: 'rec_3101_arthur',  name: 'Arthur',          date: '2026-01-31', total: 45,  answers: [] },
  { id: 'rec_3101_juan',    name: 'Juan',            date: '2026-01-31', total: 20,  answers: [] },

  // ─── SÁBADO 17/01/2026 ───
  { id: 'rec_1701_vitor',   name: 'Vítor Soares',    date: '2026-01-17', total: 115, answers: [] },
  { id: 'rec_1701_isac',    name: 'Isac',            date: '2026-01-17', total: 105, answers: [] },
  { id: 'rec_1701_alex',    name: 'Alex',            date: '2026-01-17', total: 70,  answers: [] },

  // ─── PONTUAÇÕES ANTERIORES ACUMULADAS (BASE DO DRIVE) ───
  { id: 'base_luiza',       name: 'Luiza',           date: '2026-02-14', total: 325,  answers: [] },
  { id: 'base_isac',        name: 'Isac',            date: '2026-02-14', total: 710,  answers: [] },
  { id: 'base_vitor',       name: 'Vítor Soares',    date: '2026-02-14', total: 585,  answers: [] },
  { id: 'base_jonas',       name: 'Jonas',           date: '2026-02-14', total: 240,  answers: [] },
  { id: 'base_nicholas',    name: 'Nicholas',        date: '2026-02-14', total: 0,    answers: [] }
];
