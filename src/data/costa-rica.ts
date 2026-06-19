export interface Canton {
  name: string;
  districts: string[];
}

export interface Province {
  name: string;
  cantones: Canton[];
}

export const COSTA_RICA: Province[] = [
  {
    name: "San Jose",
    cantones: [
      { name: "San Jose", districts: ["Carmen","Merced","Hospital","Catedral","Zapote","San Francisco de Dos Rios","La Uruca","Mata Redonda","Pavas","Hatillo","San Sebastian","San Antonio","Desamparados","San Miguel","San Cristobal","San Juan de Dios","San Rafael","Escazu","San Ignacio","La Granja"] },
      { name: "Escazu", districts: ["Escazu Centro","San Rafael","San Antonio"] },
      { name: "Desamparados", districts: ["Desamparados","San Miguel","San Juan de Dios","San Rafael Arriba","San Antonio","Frailes","Patarrá","San Cristobal","Rosario","Damas","San Rafael Abajo","Gravilias","Los Guido"] },
      { name: "Puriscal", districts: ["Santiago","Mercedes Sur","Barbacoas","Grifo Alto","San Rafael","Candelarita","Desamparaditos","San Antonio","Chires"] },
      { name: "Tarrazu", districts: ["San Marcos","San Lorenzo","San Carlos"] },
      { name: "Aserri", districts: ["Aserri","Tarbaca","Vuelta del Jorco","San Gabriel","Legua","Monterrey","Salitrillos"] },
      { name: "Mora", districts: ["Ciudad Colon","Guayabo","Tabarcia","Piedras Negras","Picagres","Jaris","Quitirrisi"] },
      { name: "Goicoechea", districts: ["San Jose","Guadalupe","San Francisco","Calle Blancos","Mata de Platano","Ipis","Rancho Redondo","Purral"] },
      { name: "Santa Ana", districts: ["Santa Ana","Salitral","Pozos","Uruca","Piedades","Brasil"] },
      { name: "Alajuelita", districts: ["Alajuelita","San Josecito","San Antonio","Concepcion","San Felipe"] },
      { name: "Vazquez de Coronado", districts: ["San Isidro","San Rafael","Dulce Nombre de Jesus","Patalillo","Cascajal"] },
      { name: "Acosta", districts: ["San Ignacio","Guaitil","Palmichal","Cangrejal","Sabanillas"] },
      { name: "Tibas", districts: ["San Juan","Cinco Esquinas","Anselmo Llorente","Leon XIII","Colima"] },
      { name: "Moravia", districts: ["San Vicente","San Jeronimo","La Trinidad"] },
      { name: "Montes de Oca", districts: ["San Pedro","Sabanilla","Mercedes","San Rafael"] },
      { name: "Turrubares", districts: ["San Pablo","San Pedro","San Juan de Mata","San Luis","Carara"] },
      { name: "Dota", districts: ["Santa Maria","Jardin","Copey"] },
      { name: "Curridabat", districts: ["Curridabat","Granadilla","Sanchez","Tirrases"] },
      { name: "Perez Zeledon", districts: ["San Isidro de El General","El General","Daniel Flores","Rivas","San Pedro","Platanares","Pejibaye","Cajon","Baru","Rio Nuevo","Paramo"] },
      { name: "Leon Cortes Castro", districts: ["San Pablo","San Andres","Llano Bonito","San Antonio","San Rafael"] },
    ],
  },
  {
    name: "Alajuela",
    cantones: [
      { name: "Alajuela", districts: ["Alajuela","San Jose","Carrizal","San Antonio","Guacima","San Isidro","Sabanilla","San Rafael","Rio Segundo","Desamparados","Turrucares","Tambor","La Garita","Sarapiqui"] },
      { name: "San Ramon", districts: ["San Ramon","Santiago","San Juan","Piedades Norte","Piedades Sur","Alfaro","Volio","Concepcion","Zapotal","Penas Blancas"] },
      { name: "Grecia", districts: ["Grecia","San Isidro","San Jose","San Roque","Tacares","Puente de Piedra","Bolivar"] },
      { name: "San Mateo", districts: ["San Mateo","Desmonte","Jesus Maria","Labrador"] },
      { name: "Atenas", districts: ["Atenas","Jesus","Mercedes","San Isidro","Concepcion","San Jose","Santa Eulalia","Escobal"] },
      { name: "Naranjo", districts: ["Naranjo","San Miguel","San Jose","Cirri Sur","San Jeronimo","San Juan","El Rosario","Palmitos"] },
      { name: "Palmares", districts: ["Palmares","Zaragoza","Buenos Aires","Santiago","Candelaria","Esquipulas","La Granja"] },
      { name: "Poas", districts: ["San Pedro","San Juan","San Rafael","Carrillos","Sabana Redonda"] },
      { name: "Orotina", districts: ["Orotina","El Mastate","Hacienda Vieja","Coyolar","La Ceiba"] },
      { name: "San Carlos", districts: ["Quesada","Florencia","Buenavista","Aguas Zarcas","Venecia","Pital","La Fortuna","La Tigra","La Palmera","Venado","Cutris","Monterrey","Pocosol"] },
      { name: "Zarcero", districts: ["Zarcero","Laguna","Tapesco","Guadalupe","Palmira","Zapote","Brisas"] },
      { name: "Sarchi", districts: ["Sarchi Norte","Sarchi Sur","Toro Amarillo","San Pedro","Rodriguez"] },
      { name: "Upala", districts: ["Upala","Aguas Claras","San Jose","Bijagua","Delicias","Dos Rios","Yolillal","Canalete"] },
      { name: "Los Chiles", districts: ["Los Chiles","Cano Negro","El Amparo","San Jorge"] },
      { name: "Guatuso", districts: ["San Rafael","Buenavista","Cote","Katira"] },
      { name: "Rio Cuarto", districts: ["Rio Cuarto","Santa Isabel","Santa Rita"] },
    ],
  },
  {
    name: "Cartago",
    cantones: [
      { name: "Cartago", districts: ["Oriental","Occidental","Carmen","San Nicolas","Aguacaliente","Guadalupe","Corralillo","Tierra Blanca","Dulce Nombre","Llano Grande","Quebradilla"] },
      { name: "Paraiso", districts: ["Paraiso","Santiago","Orosi","Cachi","La Cuesta","Birrisito","Llanos de Santa Lucia"] },
      { name: "La Union", districts: ["Tres Rios","San Diego","San Juan","San Rafael","Concepcion","Dulce Nombre","San Ramon","Rio Azul"] },
      { name: "Jimenez", districts: ["Juan Vinas","Tucurrique","Pejibaye","La Isabel"] },
      { name: "Turrialba", districts: ["Turrialba","La Suiza","Peralta","Santa Cruz","Santa Teresita","Pavones","Tuis","Tayutic","Santa Rosa","Tres Equis","La Isabel","Chirripo","Catie"] },
      { name: "Alvarado", districts: ["Pacayas","Cervantes","Capellades"] },
      { name: "Oreamuno", districts: ["San Rafael","Cot","Potrero Cerrado","Cipreses","Santa Rosa"] },
      { name: "El Guarco", districts: ["El Tejar","San Isidro","Tobosi","Patio de Agua"] },
    ],
  },
  {
    name: "Heredia",
    cantones: [
      { name: "Heredia", districts: ["Heredia","Mercedes","San Francisco","Ulloa","Varablanca"] },
      { name: "Barva", districts: ["Barva","San Pedro","San Pablo","San Roque","Santa Lucia","San Jose de la Montana"] },
      { name: "Santo Domingo", districts: ["Santo Domingo","San Vicente","San Miguel","Paracito","Santo Tomas","Santa Rosa","Tures","Para"] },
      { name: "Santa Barbara", districts: ["Santa Barbara","San Pedro","San Juan","Jesus","Santo Domingo","Puraba"] },
      { name: "San Rafael", districts: ["San Rafael","San Josecito","Santiago","Los Angeles","Penas Blancas"] },
      { name: "San Isidro", districts: ["San Isidro","San Jose","Concepcion","San Francisco"] },
      { name: "Belen", districts: ["San Antonio","La Ribera","La Asuncion"] },
      { name: "Flores", districts: ["San Joaquin","Barrantes","Llorente"] },
      { name: "San Pablo", districts: ["San Pablo","San Pedro","San Juan","San Miguel"] },
      { name: "Sarapiqui", districts: ["Puerto Viejo","La Virgen","Horquetas","Llanuras del Gaspar","Curena"] },
    ],
  },
  {
    name: "Guanacaste",
    cantones: [
      { name: "Liberia", districts: ["Liberia","Canas Dulces","Mayorga","Nacascolo","Curubande"] },
      { name: "Nicoya", districts: ["Nicoya","Mansion","San Antonio","Quebrada Honda","Samara","Nosara","Belen de Nosarita"] },
      { name: "Santa Cruz", districts: ["Santa Cruz","Bolson","Veintisiete de Abril","Tempate","Cartagena","Cuajiniquil","Diria","Cabo Velas","Tamarindo"] },
      { name: "Bagaces", districts: ["Bagaces","La Fortuna","Mogote","Rio Naranjo"] },
      { name: "Carrillo", districts: ["Filadelfia","Palmira","Sardinal","Belen"] },
      { name: "Canas", districts: ["Canas","Palmira","San Miguel","Bebedero","Porozal"] },
      { name: "Abangares", districts: ["Las Juntas","Sierra","San Juan","Colorado"] },
      { name: "Tilaran", districts: ["Tilaran","Quebrada Grande","Tronadora","Santa Rosa","Libano","Tierras Morenas"] },
      { name: "Nandayure", districts: ["Carmona","Santa Rita","Zapotal","San Pablo","Porvenir","Bejuco"] },
      { name: "La Cruz", districts: ["La Cruz","Santa Cecilia","La Garita","Santa Elena"] },
      { name: "Hojancha", districts: ["Hojancha","Monte Romo","Puerto Carrillo","Huacas"] },
    ],
  },
  {
    name: "Puntarenas",
    cantones: [
      { name: "Puntarenas", districts: ["Puntarenas","Pitahaya","Chomes","Lepanto","Paquera","Manzanillo","Guacimal","Barranca","Monte Verde","Isla del Coco","Cobano","Chacarita","Chira","Acapulco","El Roble","Arancibia"] },
      { name: "Esparza", districts: ["Espiritu Santo","San Juan Grande","Macacona","San Rafael","San Jeronimo"] },
      { name: "Buenos Aires", districts: ["Buenos Aires","Volcan","Potrero Grande","Boruca","Pilas","Colinas","Changuena","Biolley","Brunka"] },
      { name: "Osa", districts: ["Cortes","Palmar","Sierpe","Bahia Ballena","Piedras Blancas","Bahia Drake"] },
      { name: "Golfito", districts: ["Golfito","Puerto Jimenez","Guaycara","Piedras Blancas","La Cuesta"] },
      { name: "Coto Brus", districts: ["San Vito","Sabalito","Aguabuena","Limoncito","Pittier","Gutierrez Braun"] },
      { name: "Parrita", districts: ["Parrita"] },
      { name: "Corredores", districts: ["Corredor","La Cuesta","Canoas","Laurel"] },
      { name: "Garabito", districts: ["Jaco","Tarcoles"] },
      { name: "Montes de Oro", districts: ["Miramar","La Union","San Isidro"] },
      { name: "Monteverde", districts: ["Monte Verde","Santa Elena"] },
    ],
  },
  {
    name: "Limon",
    cantones: [
      { name: "Limon", districts: ["Limon","Valle La Estrella","Rio Blanco","Matama"] },
      { name: "Pococi", districts: ["Guapiles","Jimenez","La Rita","Roxana","Cariari","Colorado","La Colonia"] },
      { name: "Siquirres", districts: ["Siquirres","Pacuarito","Florida","Germania","Cairo","Alegria","Reventazon"] },
      { name: "Talamanca", districts: ["Bribri","Sixaola","Cahuita","Telire"] },
      { name: "Matina", districts: ["Matina","Batan","Carrandi"] },
      { name: "Guacimo", districts: ["Guacimo","Mercedes","Pocora","Rio Jimenez","Duacari"] },
    ],
  },
];

export function getCantones(provinceName: string): string[] {
  const province = COSTA_RICA.find((p) => p.name === provinceName);
  return province?.cantones.map((c) => c.name) ?? [];
}

export function getDistricts(provinceName: string, cantonName: string): string[] {
  const province = COSTA_RICA.find((p) => p.name === provinceName);
  const canton = province?.cantones.find((c) => c.name === cantonName);
  return canton?.districts ?? [];
}
