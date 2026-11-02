import { GENERATED_STOP_LOCATIONS } from "@/lib/generated-stop-locations";

/**
 * Kolkata transit stop coordinate registry.
 * Manual points are approximate; only confidence-checked locations are used as road-route waypoints.
 */
export type LatLng = { lat: number; lng: number };

export type StopMarker = {
  label: string;
  coord: LatLng;
  kind: "origin" | "destination" | "stop";
  index: number;
};

export const STOP_COORDS: Record<string, LatLng> = {
  // Google Geocoding API v4 confirmed Raja Subodh Mullick Square Park, Bowbazar.
  "SUBODH MALLICK SQUARE": { lat: 22.563628, lng: 88.3597739 },
  "SUBOD MALLICK SQUARE": { lat: 22.563628, lng: 88.3597739 },
  "SUBODH MALICK SQUARE": { lat: 22.563628, lng: 88.3597739 },
  // Core Kolkata & Central Business District
  "ESPLANADE":             { lat: 22.5627, lng: 88.3511 },
  "ESPL":                  { lat: 22.5627, lng: 88.3511 },
  "DHARMATALA":            { lat: 22.5627, lng: 88.3511 },
  "CURZON PARK":           { lat: 22.5627, lng: 88.3511 },
  "BBD BAG":               { lat: 22.5680, lng: 88.3468 },
  "BBD BAGH":              { lat: 22.5680, lng: 88.3468 },
  "B.B.D. BAG":            { lat: 22.5680, lng: 88.3468 },
  "B.B.D. BAGH":           { lat: 22.5680, lng: 88.3468 },
  "DALHOUSIE":             { lat: 22.5680, lng: 88.3468 },
  "PARK STREET":           { lat: 22.5516, lng: 88.3524 },
  "PARK ST":               { lat: 22.5516, lng: 88.3524 },
  "MAIDAN":                { lat: 22.5557, lng: 88.3424 },
  "MAIDEN":                { lat: 22.5557, lng: 88.3424 },
  "MAIDAN METRO":          { lat: 22.5532, lng: 88.3496 },
  "ELGIN":                 { lat: 22.5406, lng: 88.3501 },
  "ELGIN ROAD":            { lat: 22.5406, lng: 88.3501 },
  "HAZRA":                 { lat: 22.5242, lng: 88.3472 },
  "HAZRA XING":            { lat: 22.5242, lng: 88.3472 },
  "HAZRA PARK":            { lat: 22.5242, lng: 88.3472 },
  "RASHBEHARI":            { lat: 22.5188, lng: 88.3572 },
  "RASHBEHARI AVE":        { lat: 22.5188, lng: 88.3572 },
  "RASHBEHARI XING":       { lat: 22.5188, lng: 88.3572 },
  "RASHBEHARI AVENUE":     { lat: 22.5188, lng: 88.3572 },
  "R.B. AVE":              { lat: 22.5188, lng: 88.3572 },
  "R.B. AVENUE":           { lat: 22.5188, lng: 88.3572 },
  "RB AVE":                { lat: 22.5188, lng: 88.3572 },
  "DESHAPRIYA PARK":       { lat: 22.5205, lng: 88.3585 },
  "D.PARK":                { lat: 22.5205, lng: 88.3585 },
  "GARIAHAT":              { lat: 22.5188, lng: 88.3677 },
  "GOLPARK":               { lat: 22.5139, lng: 88.3685 },
  "DHAKURIA":              { lat: 22.5073, lng: 88.3668 },
  "BALLYGUNGE":            { lat: 22.5207, lng: 88.3729 },
  "BALLYGUNGE STN":        { lat: 22.5207, lng: 88.3729 },
  "BALLYGUNGE STATION":    { lat: 22.5207, lng: 88.3729 },
  "LAKE GARDENS":          { lat: 22.5075, lng: 88.3598 },
  "RABINDRA SAROVAR":      { lat: 22.5147, lng: 88.3518 },
  "TOLLYGUNGE":            { lat: 22.4962, lng: 88.3515 },
  "TOLLYGUNGE PHARI":      { lat: 22.4962, lng: 88.3515 },
  "TOLLYGUNGE METRO":      { lat: 22.4951, lng: 88.3515 },
  "TOLLYGUNGE TRAM DEPOT": { lat: 22.4955, lng: 88.3498 },
  "T.T.DEPOT":             { lat: 22.4955, lng: 88.3498 },
  "T.DEPOT":               { lat: 22.4955, lng: 88.3498 },
  "KUNDGHAT":              { lat: 22.4885, lng: 88.3492 },
  "RABINDRA SADAN":        { lat: 22.5412, lng: 88.3487 },
  "RABINDRASADAN":         { lat: 22.5412, lng: 88.3487 },
  "EXIDE":                 { lat: 22.5412, lng: 88.3487 },
  "PTS":                   { lat: 22.5435, lng: 88.3388 },
  "P.T.S":                 { lat: 22.5435, lng: 88.3388 },
  "PTS MORE":              { lat: 22.5435, lng: 88.3388 },
  "MOULALI":               { lat: 22.5607, lng: 88.3655 },
  "MOULALI MORE":          { lat: 22.5607, lng: 88.3655 },
  "SEALDAH":               { lat: 22.5651, lng: 88.3700 },
  "SEALDAH STN":           { lat: 22.5651, lng: 88.3700 },
  "SEALDAH STATION":       { lat: 22.5651, lng: 88.3700 },
  "SEALDHA":               { lat: 22.5651, lng: 88.3700 },
  "RAJABAZAR":             { lat: 22.5763, lng: 88.3745 },
  "RAJABAZAR TRAM DEPOT":  { lat: 22.5763, lng: 88.3745 },
  "PHOOLBAGAN":            { lat: 22.5710, lng: 88.3897 },
  "PHOOL BAGAN":           { lat: 22.5710, lng: 88.3897 },
  "KANKURGACHI":           { lat: 22.5793, lng: 88.3940 },
  "ULTADANGA":             { lat: 22.5896, lng: 88.3960 },
  "HUDCO":                 { lat: 22.5896, lng: 88.3960 },
  "ULTADANGA HUDCO":       { lat: 22.5896, lng: 88.3960 },
  "HUDCO MORE":            { lat: 22.5896, lng: 88.3960 },
  "MANICKTALA":            { lat: 22.5826, lng: 88.3822 },
  "MANIKTALA":             { lat: 22.5826, lng: 88.3822 },
  "KHANNA":                { lat: 22.5896, lng: 88.3768 },
  "HATIBAGAN":             { lat: 22.5925, lng: 88.3712 },
  "MG ROAD":               { lat: 22.5803, lng: 88.3655 },
  "M.G. ROAD":             { lat: 22.5803, lng: 88.3655 },
  "M.G.ROAD":              { lat: 22.5803, lng: 88.3655 },
  "GIRISH PARK":           { lat: 22.5851, lng: 88.3641 },
  "SHYAMBAZAR":            { lat: 22.6024, lng: 88.3749 },
  "SOVABAZAR":             { lat: 22.5958, lng: 88.3659 },
  "CR AVENUE":             { lat: 22.5764, lng: 88.3618 },
  "C.R. AVENUE":           { lat: 22.5764, lng: 88.3618 },
  "C.R. AVN":              { lat: 22.5764, lng: 88.3618 },
  "BURRABAZAR":            { lat: 22.5835, lng: 88.3554 },
  "BURRA BAZAR":           { lat: 22.5835, lng: 88.3554 },
  "BARABAZAR":             { lat: 22.5835, lng: 88.3554 },
  "BARRABAZAR":            { lat: 22.5835, lng: 88.3554 },
  "LALBAZAR":              { lat: 22.5726, lng: 88.3560 },
  "CENTRAL":               { lat: 22.5695, lng: 88.3582 },
  "CHANDNI CHOWK":         { lat: 22.5654, lng: 88.3548 },
  "PARK CIRCUS":           { lat: 22.5403, lng: 88.3697 },
  "BECKBAGAN":             { lat: 22.5398, lng: 88.3596 },
  "RIPON STREET":          { lat: 22.5532, lng: 88.3605 },
  "NONAPUKUR":             { lat: 22.5482, lng: 88.3688 },
  "TOPSIA":                { lat: 22.5415, lng: 88.3842 },
  "TOPSIA MORE":           { lat: 22.5415, lng: 88.3842 },

  // Howrah & Western Bank
  "HOWRAH":                { lat: 22.5850, lng: 88.3425 },
  "HOWRAH STN":            { lat: 22.5850, lng: 88.3425 },
  "HOWRAH STATION":        { lat: 22.5850, lng: 88.3425 },
  "HOWRAH BRIDGE":         { lat: 22.5855, lng: 88.3468 },
  "HOWRAH BRIDGE EAST":    { lat: 22.5855, lng: 88.3468 },
  "HOWRAH BRIDGE SOUTH":   { lat: 22.5855, lng: 88.3468 },
  "HOWRAH MAIDAN":         { lat: 22.5815, lng: 88.3285 },
  "NABANNA":               { lat: 22.5562, lng: 88.3108 },
  "SANTRAGACHI":           { lat: 22.5802, lng: 88.2805 },
  "SANTRAGACHI STN":       { lat: 22.5802, lng: 88.2805 },
  "SANTRAGACHI STATION":   { lat: 22.5802, lng: 88.2805 },
  "MANDIRTALA":            { lat: 22.5650, lng: 88.3180 },
  "MADIRTALA":             { lat: 22.5650, lng: 88.3180 },
  "TIKIAPARA":             { lat: 22.5786, lng: 88.3242 },
  "SHIBPUR":               { lat: 22.5678, lng: 88.3125 },
  "BELUR":                 { lat: 22.6380, lng: 88.3416 },
  "BELUR MATH":            { lat: 22.6380, lng: 88.3416 },
  "BALLY":                 { lat: 22.6536, lng: 88.3390 },
  "BALLY HALT":            { lat: 22.6536, lng: 88.3390 },
  "BALLYHALT":             { lat: 22.6536, lng: 88.3390 },
  "LILUAH":                { lat: 22.6176, lng: 88.3362 },
  "BHATTANAGAR":           { lat: 22.6322, lng: 88.3155 },
  "SALKIA":                { lat: 22.6025, lng: 88.3283 },
  "SANKRAIL":              { lat: 22.5620, lng: 88.2380 },
  "SANKRAIL BHARAT CO OP": { lat: 22.5620, lng: 88.2380 },
  "KWIC":                  { lat: 22.6085, lng: 88.2562 },
  "DANKUNI":               { lat: 22.6844, lng: 88.2952 },
  "RAJCHANDRAPUR":         { lat: 22.6648, lng: 88.3340 },
  "RAJCHANDRA PUR":        { lat: 22.6648, lng: 88.3340 },

  // South Kolkata & Suburbs
  "GARIA":                 { lat: 22.4641, lng: 88.3842 },
  "GARIA BUS STAND":       { lat: 22.4641, lng: 88.3842 },
  "GARIA METRO":           { lat: 22.4641, lng: 88.3842 },
  "KAVI SUBHASH":          { lat: 22.4705, lng: 88.3965 },
  "NAKTALA":               { lat: 22.4718, lng: 88.3685 },
  "REGENT PARK":           { lat: 22.4782, lng: 88.3582 },
  "RANIKHUTI":             { lat: 22.4842, lng: 88.3542 },
  "RANI KUTHI":            { lat: 22.4842, lng: 88.3542 },
  "GANGULI BAGAN":         { lat: 22.4785, lng: 88.3755 },
  "BAGHAJATIN":            { lat: 22.4868, lng: 88.3725 },
  "JADAVPUR":              { lat: 22.4988, lng: 88.3712 },
  "JADAVPORE":             { lat: 22.4988, lng: 88.3712 },
  "JADAVPUR P.S":          { lat: 22.4988, lng: 88.3712 },
  "JADAVPUR THANA":        { lat: 22.4988, lng: 88.3712 },
  "SUKANTA SETU":          { lat: 22.4965, lng: 88.3745 },
  "PRINCE ANWAR SHAH":     { lat: 22.5032, lng: 88.3585 },
  "ANWAR SHAH RD":         { lat: 22.5032, lng: 88.3585 },
  "GOLF GREEN":            { lat: 22.4883, lng: 88.3621 },
  "HARIDEVPUR":            { lat: 22.4788, lng: 88.3365 },
  "HARIDEBPUR":            { lat: 22.4788, lng: 88.3365 },
  "KABARDANGA":            { lat: 22.4632, lng: 88.3282 },
  "BEHALA":                { lat: 22.4980, lng: 88.3130 },
  "BEHALA CHOWRASTA":      { lat: 22.4935, lng: 88.3120 },
  "CHOWRASTA":             { lat: 22.4935, lng: 88.3120 },
  "MANTON":                { lat: 22.4960, lng: 88.3125 },
  "MANTON XING":           { lat: 22.4960, lng: 88.3125 },
  "BEHALA TRAM DEPOT":     { lat: 22.5015, lng: 88.3142 },
  "TARATALA":              { lat: 22.5133, lng: 88.3182 },
  "TARATALA XING":         { lat: 22.5133, lng: 88.3182 },
  "T.T.XING":              { lat: 22.5133, lng: 88.3182 },
  "NEW ALIPORE":           { lat: 22.5085, lng: 88.3292 },
  "NEWALIPORE":            { lat: 22.5085, lng: 88.3292 },
  "ALIPORE":               { lat: 22.5285, lng: 88.3325 },
  "ALIPUR":                { lat: 22.5285, lng: 88.3325 },
  "ALIPUR RD":             { lat: 22.5285, lng: 88.3325 },
  "CHETLA":                { lat: 22.5186, lng: 88.3375 },
  "KALIGHAT":              { lat: 22.5192, lng: 88.3435 },
  "MOMINPUR":              { lat: 22.5284, lng: 88.3242 },
  "MOMINPOR":              { lat: 22.5284, lng: 88.3242 },
  "KHIDIRPUR":             { lat: 22.5385, lng: 88.3248 },
  "KHIDERPORE":            { lat: 22.5385, lng: 88.3248 },
  "KHIDDERPUR":            { lat: 22.5385, lng: 88.3248 },
  "KHIDDERPORE":           { lat: 22.5385, lng: 88.3248 },
  "FANCY MARKET":          { lat: 22.5385, lng: 88.3262 },
  "HASTINGS":              { lat: 22.5492, lng: 88.3312 },
  "HESTINGS":              { lat: 22.5492, lng: 88.3312 },
  "VIDYASAGAR SETU":       { lat: 22.5574, lng: 88.3278 },
  "VIDHYA SAGAR SATU":     { lat: 22.5574, lng: 88.3278 },
  "PARNASREE":             { lat: 22.4965, lng: 88.3039 },
  "PARNASHREE":            { lat: 22.4965, lng: 88.3039 },
  "PARNASHRI":             { lat: 22.4965, lng: 88.3039 },
  "SARSUNA":               { lat: 22.4746, lng: 88.2831 },
  "SHAKUNTALA PARK":       { lat: 22.4850, lng: 88.2955 },
  "SAKUNTALA PARK":        { lat: 22.4850, lng: 88.2955 },
  "THAKURPUKUR":           { lat: 22.4608, lng: 88.3072 },
  "THAKURPUKUR 3A":        { lat: 22.4608, lng: 88.3072 },
  "JOKA":                  { lat: 22.4357, lng: 88.2938 },
  "AMTALA":                { lat: 22.3832, lng: 88.2685 },
  "DAHIGHAT":              { lat: 22.5456, lng: 88.3184 },
  "BICHALIGHAT":           { lat: 22.5428, lng: 88.2934 },
  "METIABRUZ":             { lat: 22.5381, lng: 88.2818 },
  "METIABRUJ":             { lat: 22.5381, lng: 88.2818 },
  "H M GHOSH COLLEGE":     { lat: 22.5381, lng: 88.2818 },
  "AKRA":                  { lat: 22.5185, lng: 88.2570 },
  "AKRA RABINDRANAGAR":    { lat: 22.5185, lng: 88.2570 },
  "EDEN CITY":             { lat: 22.4982, lng: 88.2205 },
  "NUNGI":                 { lat: 22.4962, lng: 88.2238 },
  "BUDGE BUDGE":           { lat: 22.4827, lng: 88.1812 },
  "ACHIPUR":               { lat: 22.4578, lng: 88.1636 },
  "DAKGHAR":               { lat: 22.5028, lng: 88.2452 },
  "MOLLAR GATE":           { lat: 22.5065, lng: 88.2678 },
  "JINGIRA BAZAR":         { lat: 22.5108, lng: 88.2912 },
  "SHIBRAMPUR":            { lat: 22.4715, lng: 88.2885 },
  "SASTHIR MORE":          { lat: 22.4735, lng: 88.2842 },
  "SONAMUKHI BAZAR":       { lat: 22.4760, lng: 88.2810 },
  "BAGPOTA":               { lat: 22.4855, lng: 88.2612 },
  "SHIBTALA MATH":         { lat: 22.4752, lng: 88.2862 },
  "JANAKALYAN":            { lat: 22.4722, lng: 88.2815 },
  "HANSKHALI":             { lat: 22.4682, lng: 88.2785 },

  // Eastern Bypass & Salt Lake & New Town Arteries
  "PATULI":                { lat: 22.4712, lng: 88.3978 },
  "PEERLESS":              { lat: 22.4842, lng: 88.4005 },
  "PEERLESS HOSPITAL":     { lat: 22.4842, lng: 88.4005 },
  "AJOY NAGAR":            { lat: 22.4938, lng: 88.3976 },
  "AJOYNAGAR":             { lat: 22.4938, lng: 88.3976 },
  "AJAY NAGAR":            { lat: 22.4938, lng: 88.3976 },
  "HILAND PARK":           { lat: 22.4842, lng: 88.3965 },
  "HILAND WILLOW":         { lat: 22.4842, lng: 88.3965 },
  "PICNIC PARK":           { lat: 22.4842, lng: 88.3965 },
  "KALIKAPUR":             { lat: 22.5054, lng: 88.3988 },
  "SAPUIPARA":             { lat: 22.5015, lng: 88.3842 },
  "SANPUI PARA":           { lat: 22.5015, lng: 88.3842 },
  "KASBA CONNECTOR":       { lat: 22.5165, lng: 88.3885 },
  "BIJON SETU":            { lat: 22.5195, lng: 88.3755 },
  "RUBY":                  { lat: 22.5132, lng: 88.4025 },
  "RUBY HOSPITAL":         { lat: 22.5132, lng: 88.4025 },
  "VIP BAZAR":             { lat: 22.5242, lng: 88.3995 },
  "SCIENCE CITY":          { lat: 22.5402, lng: 88.3965 },
  "SC. CITY":              { lat: 22.5402, lng: 88.3965 },
  "SC CITY":               { lat: 22.5402, lng: 88.3965 },
  "S.CITY":                { lat: 22.5402, lng: 88.3965 },
  "METROPOLITAN":          { lat: 22.5518, lng: 88.4025 },
  "CHINGRIGHATA":          { lat: 22.5638, lng: 88.4035 },
  "CHINGRIHATA":           { lat: 22.5638, lng: 88.4035 },
  "APOLLO HOSPITAL":       { lat: 22.5760, lng: 88.4015 },
  "APOLLO":                { lat: 22.5760, lng: 88.4015 },
  "APPOLO HOSPITAL":       { lat: 22.5760, lng: 88.4015 },
  "BENGAL CHEMICAL":       { lat: 22.5740, lng: 88.3985 },
  "MANI SQUARE":           { lat: 22.5805, lng: 88.4010 },
  "SUKANTA NAGAR":         { lat: 22.5638, lng: 88.4112 },
  "NICCO PARK":            { lat: 22.5714, lng: 88.4208 },
  "SDF":                   { lat: 22.5794, lng: 88.4322 },
  "COLLEGE MORE":          { lat: 22.5746, lng: 88.4338 },
  "TECHNOPOLIS":           { lat: 22.5824, lng: 88.4357 },
  "TECHONOPOLIS":          { lat: 22.5824, lng: 88.4357 },
  "SWASTHA BHAVAN":        { lat: 22.5835, lng: 88.4214 },
  "KARUNAMOYEE":           { lat: 22.5862, lng: 88.4182 },
  "CENTRAL PARK":          { lat: 22.5898, lng: 88.4147 },
  "BIKASH BHAVAN":         { lat: 22.5898, lng: 88.4147 },
  "UNNAYAN BHAVAN":        { lat: 22.5880, lng: 88.4132 },
  "CITY CENTRE":           { lat: 22.5892, lng: 88.4083 },
  "CITY CENTRE 1":         { lat: 22.5892, lng: 88.4083 },
  "CITY CENTRE I":         { lat: 22.5892, lng: 88.4083 },
  "SALT LAKE":             { lat: 22.5862, lng: 88.4182 },
  "SALT LAKE DEPOT GATE":  { lat: 22.5768, lng: 88.4185 },
  "NEW TOWN":              { lat: 22.5842, lng: 88.4593 },
  "NEWTOWN":               { lat: 22.5842, lng: 88.4593 },
  "NEW TOWN BUS TERMINUS": { lat: 22.5842, lng: 88.4593 },
  "NARKELBAGAN":           { lat: 22.5842, lng: 88.4593 },
  "NARKEL BAGAN":          { lat: 22.5842, lng: 88.4593 },
  "UNITECH":               { lat: 22.5768, lng: 88.4735 },
  "ECO SPACE":             { lat: 22.5878, lng: 88.4827 },
  "ECO PARK":              { lat: 22.6033, lng: 88.4682 },
  "CITY CENTRE 2":         { lat: 22.6288, lng: 88.4542 },
  "CITY CENTRE II":        { lat: 22.6288, lng: 88.4542 },
  "CHINAR PARK":           { lat: 22.6258, lng: 88.4485 },
  "SAPOORJI":              { lat: 22.5516, lng: 88.4975 },
  "SAPURJI":               { lat: 22.5516, lng: 88.4975 },
  "SAPOORJEE":             { lat: 22.5516, lng: 88.4975 },
  "ALIAH UNIVERSITY":      { lat: 22.5992, lng: 88.4765 },

  // Basanti Highway & South East
  "BANTALA":               { lat: 22.5312, lng: 88.4518 },
  "KATATALA":              { lat: 22.5255, lng: 88.5125 },
  "BHOJERHAT":             { lat: 22.5185, lng: 88.5750 },
  "GHATAKPUKUR":           { lat: 22.5150, lng: 88.6480 },
  "GHATATKPUKUR":          { lat: 22.5150, lng: 88.6480 },
  "MALANCHA":              { lat: 22.5283, lng: 88.7582 },
  "MINAKHAN":              { lat: 22.5880, lng: 88.7180 },
  "JOINPUR":               { lat: 22.5855, lng: 88.7050 },
  "KAMALGAZI":             { lat: 22.4348, lng: 88.3975 },
  "DHALAI BRIDGE":         { lat: 22.4578, lng: 88.3982 },
  "BARUIPUR":              { lat: 22.3560, lng: 88.4364 },
  "BARUIPUR NEW TERMINUS": { lat: 22.3560, lng: 88.4364 },
  "HARINAVI":              { lat: 22.4062, lng: 88.4202 },
  "PADMAPUKUR":            { lat: 22.3747, lng: 88.4259 },

  // VIP Road & North Suburbs
  "LAKE TOWN":             { lat: 22.6025, lng: 88.4022 },
  "LAKETOWN":              { lat: 22.6025, lng: 88.4022 },
  "BANGUR":                { lat: 22.6095, lng: 88.4115 },
  "DUM DUM PARK":          { lat: 22.6125, lng: 88.4168 },
  "KESTOPUR":              { lat: 22.6145, lng: 88.4230 },
  "SUKANTA PARK":          { lat: 22.5932, lng: 88.4325 },
  "BAGUIATI":              { lat: 22.6205, lng: 88.4285 },
  "BAGUIHATI":             { lat: 22.6205, lng: 88.4285 },
  "RAGHUNATHPUR":          { lat: 22.6265, lng: 88.4335 },
  "TEGHORIA":              { lat: 22.6318, lng: 88.4365 },
  "TEGHARIA":              { lat: 22.6318, lng: 88.4365 },
  "HALDIRAM":              { lat: 22.6398, lng: 88.4412 },
  "KAIKHALI":              { lat: 22.6415, lng: 88.4435 },
  "KOIKHALI":              { lat: 22.6415, lng: 88.4435 },
  "AIRPORT":               { lat: 22.6530, lng: 88.4480 },
  "AIR PORT":              { lat: 22.6530, lng: 88.4480 },
  "AIRPORT GATE NO. 1":    { lat: 22.6465, lng: 88.4470 },
  "AIRPORT GATE 1":        { lat: 22.6465, lng: 88.4470 },
  "AIRPORT TERMINAL":      { lat: 22.6530, lng: 88.4480 },
  "BIRATI":                { lat: 22.6715, lng: 88.4385 },
  "MICHAEL NAGAR":         { lat: 22.6782, lng: 88.4465 },
  "NEW BARRACKPORE":       { lat: 22.6965, lng: 88.4525 },
  "MADHYAMGRAM":           { lat: 22.7042, lng: 88.4565 },
  "HRIDAYPUR":             { lat: 22.7155, lng: 88.4725 },
  "BARASAT":               { lat: 22.7215, lng: 88.4835 },
  "STATE UNIVERSITY":      { lat: 22.7485, lng: 88.4982 },
  "HABRA":                 { lat: 22.8362, lng: 88.6575 },
  "ASHOKNAGAR":            { lat: 22.8476, lng: 88.6173 },
  "GANGANAGAR":            { lat: 22.6825, lng: 88.4612 },
  "BHEBIA":                { lat: 22.6350, lng: 88.5420 },

  // BT Road & Northern Corridor
  "DUM DUM":               { lat: 22.6225, lng: 88.3785 },
  "DUM DUM STN":           { lat: 22.6225, lng: 88.3785 },
  "PAIKPARA":              { lat: 22.6074, lng: 88.3842 },
  "KOLKATA STN":           { lat: 22.6028, lng: 88.3755 },
  "BAGHBAZAR":             { lat: 22.6035, lng: 88.3662 },
  "ARIADAHA":              { lat: 22.6685, lng: 88.3625 },
  "DAKSHINESWAR":          { lat: 22.6547, lng: 88.3582 },
  "DUNLOP":                { lat: 22.6517, lng: 88.3789 },
  "BELGHORIA":             { lat: 22.6625, lng: 88.3855 },
  "AGARPARA":              { lat: 22.6812, lng: 88.3815 },
  "SODEPUR":               { lat: 22.7011, lng: 88.3845 },
  "SODPUR":                { lat: 22.7011, lng: 88.3845 },
  "KHARDAH":               { lat: 22.7215, lng: 88.3812 },
  "TITAGARH":              { lat: 22.7383, lng: 88.3752 },
  "BARRACKPORE":           { lat: 22.7632, lng: 88.3688 },
  "BARRACKPUR":            { lat: 22.7632, lng: 88.3688 },
  "NEILGUNJ":              { lat: 22.7536, lng: 88.4052 },
  "NAIHATI":               { lat: 22.8867, lng: 88.4246 },
};

export function norm(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export type StopLocationSource = "manual" | "geocoding" | "geocoding-v4" | "places-new";
export type ResolvedStopLocation = LatLng & { id: string; name: string; formattedAddress?: string; placeId?: string; source: StopLocationSource; verified: boolean; confidence?: number; aliases?: string[] };
const STOP_LOCATION_CACHE_KEY = "smartbus-resolved-stop-locations-v1";
const resolvedStopLocations = new Map<string, ResolvedStopLocation>();
const pendingStopLookups = new Map<string, Promise<boolean>>();
let stopCacheHydrated = false;
const verifiedAliases: Record<string, string> = {
  "SUBOD MALICK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBOD MALLICK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBOD MALLICK SQURE": "SUBODH MALLICK SQUARE",
  "SUBOD MALIK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBODH MALICK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBODH MALIK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBODH MULLICK SQUARE": "SUBODH MALLICK SQUARE",
  "SUBODH MALLICK SQ": "SUBODH MALLICK SQUARE",
};
resolvedStopLocations.set("SUBODH MALLICK SQUARE", { id: "subodh-mallick-square", name: "Raja Subodh Mallick Square Park", lat: 22.563628, lng: 88.3597739, placeId: "ChIJafYVnAB3AjoRXCyFTygj6i0", source: "geocoding-v4", verified: true, confidence: 1 });
Object.entries(GENERATED_STOP_LOCATIONS).forEach(([name, location]) => {
  const key = norm(name);
  const record: ResolvedStopLocation = { id: key.toLowerCase().replace(/\s+/g, "-"), name, lat: location.latitude, lng: location.longitude, placeId: location.placeId, formattedAddress: location.formattedAddress, source: location.source || "geocoding-v4", verified: true, confidence: location.confidence };
  resolvedStopLocations.set(key, record);
  STOP_COORDS[key] = { lat: record.lat, lng: record.lng };
});

function hydrateResolvedStopCache() {
  if (stopCacheHydrated) return;
  stopCacheHydrated = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STOP_LOCATION_CACHE_KEY) || "[]") as Array<[string, Partial<ResolvedStopLocation> & LatLng]>;
    saved.forEach(([key, location]) => {
      if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && location.lat >= 22.2 && location.lat <= 23.1 && location.lng >= 87.8 && location.lng <= 88.8) {
        const restored = { ...location, id: location.id || key.toLowerCase().replace(/\s+/g, "-"), name: location.name || key, source: location.source || "geocoding", verified: location.verified ?? true } as ResolvedStopLocation;
        resolvedStopLocations.set(key, restored); STOP_COORDS[key] = { lat: location.lat, lng: location.lng };
      }
    });
  } catch { /* Storage may be unavailable; in-memory resolutions still work. */ }
}

export function registerResolvedStop(location: ResolvedStopLocation) {
  if (!location.verified || !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || location.lat < 22.2 || location.lat > 23.1 || location.lng < 87.8 || location.lng > 88.8) return false;
  const key = norm(location.name);
  if (!key) return false;
  resolvedStopLocations.set(key, location);
  STOP_COORDS[key] = { lat: location.lat, lng: location.lng };
  try { localStorage.setItem(STOP_LOCATION_CACHE_KEY, JSON.stringify(Array.from(resolvedStopLocations.entries()))); } catch { /* Keep the current page cache. */ }
  return true;
}

export function getStopLocationRecord(name: string): ResolvedStopLocation | null {
  hydrateResolvedStopCache();
  const key = norm(name);
  const canonical = verifiedAliases[key] || key;
  const cached = resolvedStopLocations.get(key) || resolvedStopLocations.get(canonical);
  if (cached) return cached;
  const coord = STOP_COORDS[canonical];
  return coord ? { id: canonical.toLowerCase().replace(/\s+/g, "-"), name, ...coord, source: "manual", verified: false } : null;
}

export async function resolveStopWithGoogle(name: string, signal?: AbortSignal) {
  if (getStopLocationRecord(name)?.verified) return true;
  const key = norm(name);
  const active = pendingStopLookups.get(key);
  if (active) return active;
  const lookup = (async () => {
    if (signal?.aborted) return false;
    const response = await fetch("/api/maps/geocode-stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Could not resolve ${name}`);
    return registerResolvedStop({ id: key.toLowerCase().replace(/\s+/g, "-"), name, formattedAddress: result.formattedAddress, lat: Number(result.latitude), lng: Number(result.longitude), placeId: result.placeId, source: result.source || "geocoding-v4", verified: true, confidence: Number(result.confidence) || undefined });
  })();
  pendingStopLookups.set(key, lookup);
  try { return await lookup; }
  finally { if (pendingStopLookups.get(key) === lookup) pendingStopLookups.delete(key); }
}

/**
 * Resolves a stop name to geographic coordinates using exact matching
 * or longest substring match against known Kolkata transit nodes.
 */
export function resolveStop(name: string): LatLng | null {
  if (!name) return null;
  hydrateResolvedStopCache();
  const key = norm(name);
  if (!key) return null;
  const canonical = verifiedAliases[key] || key;
  return STOP_COORDS[canonical] || STOP_COORDS[key] || null;
}

/**
 * Parses and returns clean, ordered stop names for a route.
 */
export function getOrderedStops(origin: string, stopsString: string, destination: string): string[] {
  const intermediate = (stopsString || "")
    .split(/[-–—,;/]/)
    .map((s) => s.replace(/^via\s*:?\s*/i, "").trim())
    .filter((s) => s.length > 0 && !s.toLowerCase().startsWith("via"));

  const raw = [origin.trim(), ...intermediate, destination.trim()].filter(Boolean);

  // Deduplicate consecutive identical names
  const result: string[] = [];
  raw.forEach((stop) => {
    if (result.length === 0 || result[result.length - 1].toLowerCase() !== stop.toLowerCase()) {
      result.push(stop);
    }
  });
  return result;
}

/**
 * Converts route origin, stoppage text, and destination into:
 * 1. An ordered LatLng polyline path
 * 2. Labelled StopMarker objects (origin, stop, destination)
 * 3. Diagnostic metadata for missing/unresolved stops
 */
export function getRouteStopsAndPath(origin: string, stopsString: string, destination: string, verifiedOnly = true): {
  path: LatLng[];
  stopMarkers: StopMarker[];
  orderedStops: string[];
  resolvedCount: number;
  totalCount: number;
  unresolvedStops: string[];
} {
  const orderedStops = getOrderedStops(origin, stopsString, destination);
  const path: LatLng[] = [];
  const stopMarkers: StopMarker[] = [];
  const unresolvedStops: string[] = [];
  const seenCoords = new Set<string>();

  orderedStops.forEach((stopName, idx) => {
    const isOrigin = idx === 0;
    const isDest = idx === orderedStops.length - 1;
    const kind: "origin" | "destination" | "stop" = isOrigin ? "origin" : isDest ? "destination" : "stop";

    const location = getStopLocationRecord(stopName);
    const coord = location && (!verifiedOnly || location.verified) ? location : null;
    if (!coord) {
      unresolvedStops.push(stopName);
      return;
    }

    const key = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
    // Always include origin and destination markers; skip duplicate intermediate stops at the exact same point
    if (!seenCoords.has(key) || isOrigin || isDest) {
      seenCoords.add(key);
      path.push(coord);
      stopMarkers.push({
        label: stopName,
        coord,
        kind,
        index: idx,
      });
    }
  });

  return {
    path,
    stopMarkers,
    orderedStops,
    resolvedCount: orderedStops.length - unresolvedStops.length,
    totalCount: orderedStops.length,
    unresolvedStops,
  };
}

export function getRouteStopSegments(origin: string, stopsString: string, destination: string, verifiedOnly = true) {
  const orderedStops = getOrderedStops(origin, stopsString, destination);
  const segments: StopMarker[][] = [];
  const unresolvedStops: string[] = [];
  let segment: StopMarker[] = [];
  const finish = () => { if (segment.length >= 2) segments.push(segment); segment = []; };
  orderedStops.forEach((label, index) => {
    const location = getStopLocationRecord(label);
    const coord = location && (!verifiedOnly || location.verified) ? location : null;
    if (!coord) { unresolvedStops.push(label); finish(); return; }
    const previous = segment[segment.length - 1];
    if (previous && previous.coord.lat === coord.lat && previous.coord.lng === coord.lng) return;
    segment.push({ label, coord, kind: index === 0 ? "origin" : index === orderedStops.length - 1 ? "destination" : "stop", index });
  });
  finish();
  return { segments, unresolvedStops, orderedStops };
}

/** Legacy helper */
export function stopsToPath(origin: string, stopsString: string, destination: string): LatLng[] {
  return getRouteStopsAndPath(origin, stopsString, destination).path;
}
