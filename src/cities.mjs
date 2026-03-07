/**
 * Moroccan cities database.
 * Each city: { id, ar, fr, lat, lng }
 */
export const CITIES = [
  // Nord
  { id: 'tanger', ar: 'طنجة', fr: 'Tanger', lat: 35.7595, lng: -5.8340 },
  { id: 'tetouan', ar: 'تطوان', fr: 'Tétouan', lat: 35.5785, lng: -5.3684 },
  { id: 'alhoceima', ar: 'الحسيمة', fr: 'Al Hoceima', lat: 35.2517, lng: -3.9372 },
  { id: 'nador', ar: 'الناظور', fr: 'Nador', lat: 35.1681, lng: -2.9330 },
  { id: 'oujda', ar: 'وجدة', fr: 'Oujda', lat: 34.6814, lng: -1.9086 },
  { id: 'berkane', ar: 'بركان', fr: 'Berkane', lat: 34.9200, lng: -2.3200 },
  { id: 'chefchaouen', ar: 'شفشاون', fr: 'Chefchaouen', lat: 35.1688, lng: -5.2636 },
  { id: 'larache', ar: 'العرائش', fr: 'Larache', lat: 35.1932, lng: -6.1557 },
  { id: 'ksar', ar: 'القصر الكبير', fr: 'Ksar el-Kébir', lat: 35.0000, lng: -5.9000 },
  { id: 'fnideq', ar: 'الفنيدق', fr: 'Fnideq', lat: 35.8494, lng: -5.3570 },

  // Atlantique
  { id: 'rabat', ar: 'الرباط', fr: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { id: 'sale', ar: 'سلا', fr: 'Salé', lat: 34.0531, lng: -6.7986 },
  { id: 'kenitra', ar: 'القنيطرة', fr: 'Kénitra', lat: 34.2610, lng: -6.5802 },
  { id: 'casablanca', ar: 'الدار البيضاء', fr: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { id: 'mohammedia', ar: 'المحمدية', fr: 'Mohammedia', lat: 33.6861, lng: -7.3829 },
  { id: 'eljadida', ar: 'الجديدة', fr: 'El Jadida', lat: 33.2549, lng: -8.5007 },
  { id: 'safi', ar: 'آسفي', fr: 'Safi', lat: 32.2994, lng: -9.2372 },
  { id: 'essaouira', ar: 'الصويرة', fr: 'Essaouira', lat: 31.5085, lng: -9.7595 },

  // Intérieur
  { id: 'fes', ar: 'فاس', fr: 'Fès', lat: 34.0331, lng: -5.0003 },
  { id: 'meknes', ar: 'مكناس', fr: 'Meknès', lat: 33.8935, lng: -5.5473 },
  { id: 'khenifra', ar: 'خنيفرة', fr: 'Khénifra', lat: 32.9340, lng: -5.6640 },
  { id: 'benimellal', ar: 'بني ملال', fr: 'Beni Mellal', lat: 32.3373, lng: -6.3498 },
  { id: 'khouribga', ar: 'خريبكة', fr: 'Khouribga', lat: 32.8811, lng: -6.9063 },
  { id: 'settat', ar: 'سطات', fr: 'Settat', lat: 33.0014, lng: -7.6163 },
  { id: 'taza', ar: 'تازة', fr: 'Taza', lat: 34.2100, lng: -4.0100 },
  { id: 'ifrane', ar: 'إفران', fr: 'Ifrane', lat: 33.5228, lng: -5.1100 },

  // Sud
  { id: 'marrakech', ar: 'مراكش', fr: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  { id: 'agadir', ar: 'أكادير', fr: 'Agadir', lat: 30.4278, lng: -9.5981 },
  { id: 'tiznit', ar: 'تزنيت', fr: 'Tiznit', lat: 29.6974, lng: -9.8022 },
  { id: 'taroudant', ar: 'تارودانت', fr: 'Taroudant', lat: 30.4700, lng: -8.8800 },
  { id: 'ouarzazate', ar: 'ورزازات', fr: 'Ouarzazate', lat: 30.9200, lng: -6.8936 },
  { id: 'errachidia', ar: 'الراشيدية', fr: 'Errachidia', lat: 31.9314, lng: -4.4343 },

  // Grand Sud
  { id: 'laayoune', ar: 'العيون', fr: 'Laâyoune', lat: 27.1536, lng: -13.2033 },
  { id: 'dakhla', ar: 'الداخلة', fr: 'Dakhla', lat: 23.7148, lng: -15.9570 },
  { id: 'guelmim', ar: 'كلميم', fr: 'Guelmim', lat: 28.9833, lng: -10.0500 },
  { id: 'tantan', ar: 'طانطان', fr: 'Tan-Tan', lat: 28.4380, lng: -11.1030 },
  { id: 'smara', ar: 'السمارة', fr: 'Smara', lat: 26.7400, lng: -11.6700 },
];

export function getCityById(id) {
  return CITIES.find(c => c.id === id) || null;
}

export function getCityByFrenchName(name) {
  return CITIES.find(c => c.fr.toLowerCase() === name.toLowerCase()) || null;
}
