/** Iran province/city dataset — 31 provinces, major cities first. */
export type IranCity = { name: string; lat: number; lng: number };
export type IranProvince = { name: string; cities: IranCity[] };

export const IRAN_PROVINCES: IranProvince[] = [
  { name: 'تهران', cities: [
    { name: 'تهران', lat: 35.6892, lng: 51.3890 },
    { name: 'شهریار', lat: 35.6589, lng: 51.0578 },
    { name: 'اسلامشهر', lat: 35.5446, lng: 51.2302 },
    { name: 'ری', lat: 35.5935, lng: 51.4400 },
    { name: 'پردیس', lat: 35.7415, lng: 51.8070 },
    { name: 'قدس', lat: 35.7219, lng: 51.1090 },
    { name: 'ملارد', lat: 35.6659, lng: 50.9767 },
    { name: 'ورامین', lat: 35.3242, lng: 51.6472 },
    { name: 'پاکدشت', lat: 35.4817, lng: 51.6803 },
    { name: 'رباط‌کریم', lat: 35.4848, lng: 51.0829 },
  ]},
  { name: 'البرز', cities: [
    { name: 'کرج', lat: 35.8400, lng: 50.9391 },
    { name: 'فردیس', lat: 35.7247, lng: 50.9883 },
    { name: 'نظرآباد', lat: 35.9139, lng: 50.6075 },
    { name: 'هشتگرد', lat: 35.9619, lng: 50.6800 },
  ]},
  { name: 'خراسان رضوی', cities: [
    { name: 'مشهد', lat: 36.2970, lng: 59.6062 },
    { name: 'نیشابور', lat: 36.2133, lng: 58.7958 },
    { name: 'سبزوار', lat: 36.2126, lng: 57.6819 },
    { name: 'تربت حیدریه', lat: 35.2740, lng: 59.2195 },
    { name: 'قوچان', lat: 37.1060, lng: 58.5094 },
    { name: 'کاشمر', lat: 35.2383, lng: 58.4656 },
    { name: 'تربت جام', lat: 35.2439, lng: 60.6225 },
    { name: 'چناران', lat: 36.6456, lng: 59.1211 },
    { name: 'گناباد', lat: 34.3528, lng: 58.6836 },
    { name: 'تایباد', lat: 34.7400, lng: 60.7756 },
    { name: 'سرخس', lat: 36.5450, lng: 61.1578 },
    { name: 'درگز', lat: 37.4444, lng: 59.1081 },
    { name: 'فریمان', lat: 35.7069, lng: 59.8456 },
    { name: 'طرقبه', lat: 36.3103, lng: 59.3736 },
    { name: 'شاندیز', lat: 36.3956, lng: 59.2986 },
  ]},
  { name: 'اصفهان', cities: [
    { name: 'اصفهان', lat: 32.6539, lng: 51.6660 },
    { name: 'کاشان', lat: 33.9850, lng: 51.4100 },
    { name: 'نجف‌آباد', lat: 32.6324, lng: 51.3676 },
  ]},
  { name: 'فارس', cities: [
    { name: 'شیراز', lat: 29.5918, lng: 52.5837 },
    { name: 'مرودشت', lat: 29.8742, lng: 52.8025 },
  ]},
  { name: 'آذربایجان شرقی', cities: [{ name: 'تبریز', lat: 38.0962, lng: 46.2738 }] },
  { name: 'آذربایجان غربی', cities: [{ name: 'ارومیه', lat: 37.5527, lng: 45.0761 }] },
  { name: 'خوزستان', cities: [{ name: 'اهواز', lat: 31.3183, lng: 48.6706 }] },
  { name: 'مازندران', cities: [{ name: 'ساری', lat: 36.5633, lng: 53.0601 }] },
  { name: 'گیلان', cities: [{ name: 'رشت', lat: 37.2808, lng: 49.5832 }] },
  { name: 'کرمان', cities: [{ name: 'کرمان', lat: 30.2839, lng: 57.0834 }] },
  { name: 'یزد', cities: [{ name: 'یزد', lat: 31.8974, lng: 54.3569 }] },
  { name: 'قم', cities: [{ name: 'قم', lat: 34.6416, lng: 50.8746 }] },
  { name: 'همدان', cities: [{ name: 'همدان', lat: 34.7983, lng: 48.5148 }] },
  { name: 'کرمانشاه', cities: [{ name: 'کرمانشاه', lat: 34.3142, lng: 47.0650 }] },
  { name: 'لرستان', cities: [{ name: 'خرم‌آباد', lat: 33.4878, lng: 48.3558 }] },
  { name: 'سیستان و بلوچستان', cities: [{ name: 'زاهدان', lat: 29.4963, lng: 60.8629 }] },
  { name: 'هرمزگان', cities: [{ name: 'بندرعباس', lat: 27.1832, lng: 56.2666 }] },
  { name: 'بوشهر', cities: [{ name: 'بوشهر', lat: 28.9234, lng: 50.8203 }] },
  { name: 'زنجان', cities: [{ name: 'زنجان', lat: 36.6769, lng: 48.4963 }] },
  { name: 'قزوین', cities: [{ name: 'قزوین', lat: 36.2797, lng: 50.0049 }] },
  { name: 'کردستان', cities: [{ name: 'سنندج', lat: 35.3219, lng: 46.9862 }] },
  { name: 'گلستان', cities: [{ name: 'گرگان', lat: 36.8456, lng: 54.4393 }] },
  { name: 'سمنان', cities: [{ name: 'سمنان', lat: 35.5769, lng: 53.3953 }] },
  { name: 'اردبیل', cities: [{ name: 'اردبیل', lat: 38.2498, lng: 48.2933 }] },
  { name: 'چهارمحال و بختیاری', cities: [{ name: 'شهرکرد', lat: 32.3256, lng: 50.8644 }] },
  { name: 'کهگیلویه و بویراحمد', cities: [{ name: 'یاسوج', lat: 30.6684, lng: 51.5876 }] },
  { name: 'ایلام', cities: [{ name: 'ایلام', lat: 33.6374, lng: 46.4227 }] },
  { name: 'خراسان شمالی', cities: [{ name: 'بجنورد', lat: 37.4750, lng: 57.3333 }] },
  { name: 'خراسان جنوبی', cities: [{ name: 'بیرجند', lat: 32.8663, lng: 59.2211 }] },
  { name: 'مرکزی', cities: [{ name: 'اراک', lat: 34.0917, lng: 49.6892 }] },
];

export function citiesOf(province: string): IranCity[] {
  return IRAN_PROVINCES.find((p) => p.name === province)?.cities ?? [];
}

export function findCity(province: string, city: string): IranCity | undefined {
  return citiesOf(province).find((c) => c.name === city);
}
