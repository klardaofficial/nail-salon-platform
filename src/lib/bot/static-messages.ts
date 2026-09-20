// Deterministic, per-language copy used when an organization's AI bot is
// disabled (organization_settings.ai_bot_enabled = false). Mirrors the
// curated-list-plus-graceful-fallback shape of src/lib/currencies.ts: a flat
// catalog keyed by the same codes as languageOptions (src/lib/bot/language.ts),
// with a lookup that can never throw because organization_settings.bot_locale
// only has a loose length check in the database.
//
// Every template uses {placeholder} tokens interpolated by formatStaticMessage.
// cancelAction is the interactive button title and must stay <= 20 characters
// in every language -- src/integrations/whatsapp/message-body.ts truncates
// button titles at 20.

export type StaticMessageFields = {
  appointment: string;
  salon: string;
  services: string;
  technician: string;
  customer: string;
  phone: string;
};

export type StaticMessageBundle = {
  greeting: string;
  bookingConfirmed: string;
  bookingCancelled: string;
  bookingNotCancellable: string;
  bookingUnavailable: string;
  cancelAction: string;
  technicianConfirmed: string;
  technicianCancelled: string;
  fields: StaticMessageFields;
};

export const staticMessageCatalog: Record<string, StaticMessageBundle> = {
  ar: {
    greeting: "مرحبًا! لحجز موعد، يرجى زيارة: {website}",
    bookingConfirmed: "تم تأكيد موعدك ✅\n{details}\nرقم المرجع: {reference}",
    bookingCancelled:
      "تم إلغاء موعدك ❌\nرقم المرجع: {reference}\nللحجز مرة أخرى، يرجى زيارة: {website}",
    bookingNotCancellable: "لا يمكن إلغاء هذا الحجز الآن. قد يكون قد تم إلغاؤه مسبقًا أو بدأ الموعد.",
    bookingUnavailable: "عذرًا، هذا الوقت غير متاح الآن. يرجى زيارة {website} لاختيار وقت جديد.",
    cancelAction: "إلغاء",
    technicianConfirmed: "حجز جديد مؤكد ✅\n{details}",
    technicianCancelled: "تم إلغاء الحجز ❌\n{details}",
    fields: {
      appointment: "الموعد",
      salon: "الصالون",
      services: "الخدمات",
      technician: "الأخصائي",
      customer: "العميل",
      phone: "الهاتف",
    },
  },
  bn: {
    greeting: "হ্যালো! অ্যাপয়েন্টমেন্ট বুক করতে অনুগ্রহ করে ভিজিট করুন: {website}",
    bookingConfirmed: "আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে ✅\n{details}\nরেফারেন্স: {reference}",
    bookingCancelled:
      "আপনার অ্যাপয়েন্টমেন্ট বাতিল করা হয়েছে ❌\nরেফারেন্স: {reference}\nপুনরায় বুক করতে ভিজিট করুন: {website}",
    bookingNotCancellable:
      "এই বুকিং আর বাতিল করা যাবে না। এটি ইতিমধ্যে বাতিল হয়ে থাকতে পারে বা শুরু হয়ে গেছে।",
    bookingUnavailable: "দুঃখিত, এই সময়টি আর উপলব্ধ নেই। নতুন সময় বেছে নিতে {website} ভিজিট করুন।",
    cancelAction: "বাতিল করুন",
    technicianConfirmed: "নতুন বুকিং নিশ্চিত হয়েছে ✅\n{details}",
    technicianCancelled: "বুকিং বাতিল হয়েছে ❌\n{details}",
    fields: {
      appointment: "অ্যাপয়েন্টমেন্ট",
      salon: "সালন",
      services: "পরিষেবা",
      technician: "টেকনিশিয়ান",
      customer: "গ্রাহক",
      phone: "ফোন",
    },
  },
  "zh-CN": {
    greeting: "您好！预约请访问：{website}",
    bookingConfirmed: "您的预约已确认 ✅\n{details}\n参考编号：{reference}",
    bookingCancelled: "您的预约已取消 ❌\n参考编号：{reference}\n如需重新预约，请访问：{website}",
    bookingNotCancellable: "此预约现在无法取消，可能已被取消或已经开始。",
    bookingUnavailable: "抱歉，该时间已不可用。请访问 {website} 选择新的时间。",
    cancelAction: "取消",
    technicianConfirmed: "新预约已确认 ✅\n{details}",
    technicianCancelled: "预约已取消 ❌\n{details}",
    fields: {
      appointment: "预约时间",
      salon: "门店",
      services: "服务项目",
      technician: "美甲师",
      customer: "客户",
      phone: "电话",
    },
  },
  "zh-TW": {
    greeting: "您好！預約請造訪：{website}",
    bookingConfirmed: "您的預約已確認 ✅\n{details}\n參考編號：{reference}",
    bookingCancelled: "您的預約已取消 ❌\n參考編號：{reference}\n如需重新預約，請造訪：{website}",
    bookingNotCancellable: "此預約目前無法取消，可能已被取消或已經開始。",
    bookingUnavailable: "抱歉，該時段已不可用。請造訪 {website} 選擇新的時間。",
    cancelAction: "取消",
    technicianConfirmed: "新預約已確認 ✅\n{details}",
    technicianCancelled: "預約已取消 ❌\n{details}",
    fields: {
      appointment: "預約時間",
      salon: "門店",
      services: "服務項目",
      technician: "美甲師",
      customer: "客戶",
      phone: "電話",
    },
  },
  cs: {
    greeting: "Dobrý den! Pro rezervaci termínu navštivte: {website}",
    bookingConfirmed: "Vaše rezervace byla potvrzena ✅\n{details}\nČíslo rezervace: {reference}",
    bookingCancelled:
      "Vaše rezervace byla zrušena ❌\nČíslo rezervace: {reference}\nPro novou rezervaci navštivte: {website}",
    bookingNotCancellable: "Tuto rezervaci již nelze zrušit. Možná byla již zrušena nebo již začala.",
    bookingUnavailable: "Omlouváme se, tento čas již není k dispozici. Nový čas vyberte na {website}.",
    cancelAction: "Zrušit",
    technicianConfirmed: "Nová rezervace potvrzena ✅\n{details}",
    technicianCancelled: "Rezervace zrušena ❌\n{details}",
    fields: {
      appointment: "Termín",
      salon: "Salon",
      services: "Služby",
      technician: "Technik",
      customer: "Klient",
      phone: "Telefon",
    },
  },
  da: {
    greeting: "Hej! For at booke en tid, besøg venligst: {website}",
    bookingConfirmed: "Din tid er bekræftet ✅\n{details}\nReference: {reference}",
    bookingCancelled:
      "Din tid er blevet aflyst ❌\nReference: {reference}\nFor at booke igen, besøg: {website}",
    bookingNotCancellable:
      "Denne booking kan ikke længere aflyses. Den kan allerede være aflyst eller er allerede startet.",
    bookingUnavailable:
      "Beklager, dette tidspunkt er ikke længere tilgængeligt. Besøg {website} for at vælge et nyt tidspunkt.",
    cancelAction: "Annuller",
    technicianConfirmed: "Ny booking bekræftet ✅\n{details}",
    technicianCancelled: "Booking aflyst ❌\n{details}",
    fields: {
      appointment: "Tid",
      salon: "Salon",
      services: "Behandlinger",
      technician: "Behandler",
      customer: "Kunde",
      phone: "Telefon",
    },
  },
  nl: {
    greeting: "Hallo! Om een afspraak te boeken, ga naar: {website}",
    bookingConfirmed: "Je afspraak is bevestigd ✅\n{details}\nReferentie: {reference}",
    bookingCancelled:
      "Je afspraak is geannuleerd ❌\nReferentie: {reference}\nOm opnieuw te boeken, ga naar: {website}",
    bookingNotCancellable:
      "Deze afspraak kan niet meer worden geannuleerd. Mogelijk is deze al geannuleerd of al begonnen.",
    bookingUnavailable:
      "Sorry, dit tijdstip is niet meer beschikbaar. Ga naar {website} om een nieuw tijdstip te kiezen.",
    cancelAction: "Annuleren",
    technicianConfirmed: "Nieuwe afspraak bevestigd ✅\n{details}",
    technicianCancelled: "Afspraak geannuleerd ❌\n{details}",
    fields: {
      appointment: "Afspraak",
      salon: "Salon",
      services: "Behandelingen",
      technician: "Behandelaar",
      customer: "Klant",
      phone: "Telefoon",
    },
  },
  en: {
    greeting: "Hello! To book an appointment, please visit: {website}",
    bookingConfirmed: "Your appointment is confirmed ✅\n{details}\nReference: {reference}",
    bookingCancelled:
      "Your appointment has been cancelled ❌\nReference: {reference}\nTo book again, please visit: {website}",
    bookingNotCancellable:
      "This booking can no longer be cancelled. It may already be cancelled or may have already started.",
    bookingUnavailable:
      "Sorry, that time is no longer available. Please visit {website} to choose a new time.",
    cancelAction: "Cancel",
    technicianConfirmed: "New booking confirmed ✅\n{details}",
    technicianCancelled: "Booking cancelled ❌\n{details}",
    fields: {
      appointment: "Appointment",
      salon: "Salon",
      services: "Services",
      technician: "Technician",
      customer: "Customer",
      phone: "Phone",
    },
  },
  fi: {
    greeting: "Hei! Varaa aika osoitteessa: {website}",
    bookingConfirmed: "Varauksesi on vahvistettu ✅\n{details}\nViite: {reference}",
    bookingCancelled:
      "Varauksesi on peruutettu ❌\nViite: {reference}\nVaraa uusi aika osoitteessa: {website}",
    bookingNotCancellable:
      "Tätä varausta ei voi enää peruuttaa. Se on saatettu jo peruuttaa tai se on jo alkanut.",
    bookingUnavailable:
      "Valitettavasti tämä aika ei ole enää käytettävissä. Valitse uusi aika osoitteessa {website}.",
    cancelAction: "Peruuta",
    technicianConfirmed: "Uusi varaus vahvistettu ✅\n{details}",
    technicianCancelled: "Varaus peruutettu ❌\n{details}",
    fields: {
      appointment: "Aika",
      salon: "Salonki",
      services: "Palvelut",
      technician: "Tekijä",
      customer: "Asiakas",
      phone: "Puhelin",
    },
  },
  fr: {
    greeting: "Bonjour ! Pour réserver un rendez-vous, veuillez visiter : {website}",
    bookingConfirmed: "Votre rendez-vous est confirmé ✅\n{details}\nRéférence : {reference}",
    bookingCancelled:
      "Votre rendez-vous a été annulé ❌\nRéférence : {reference}\nPour réserver à nouveau, veuillez visiter : {website}",
    bookingNotCancellable:
      "Cette réservation ne peut plus être annulée. Elle a peut-être déjà été annulée ou a déjà commencé.",
    bookingUnavailable:
      "Désolé, ce créneau n'est plus disponible. Veuillez visiter {website} pour choisir un nouveau créneau.",
    cancelAction: "Annuler",
    technicianConfirmed: "Nouvelle réservation confirmée ✅\n{details}",
    technicianCancelled: "Réservation annulée ❌\n{details}",
    fields: {
      appointment: "Rendez-vous",
      salon: "Salon",
      services: "Services",
      technician: "Technicien(ne)",
      customer: "Client(e)",
      phone: "Téléphone",
    },
  },
  de: {
    greeting: "Hallo! Um einen Termin zu buchen, besuchen Sie bitte: {website}",
    bookingConfirmed: "Ihr Termin wurde bestätigt ✅\n{details}\nReferenz: {reference}",
    bookingCancelled:
      "Ihr Termin wurde storniert ❌\nReferenz: {reference}\nUm erneut zu buchen, besuchen Sie: {website}",
    bookingNotCancellable:
      "Dieser Termin kann nicht mehr storniert werden. Er wurde möglicherweise bereits storniert oder hat bereits begonnen.",
    bookingUnavailable:
      "Entschuldigung, dieser Termin ist nicht mehr verfügbar. Bitte besuchen Sie {website}, um einen neuen Termin zu wählen.",
    cancelAction: "Stornieren",
    technicianConfirmed: "Neuer Termin bestätigt ✅\n{details}",
    technicianCancelled: "Termin storniert ❌\n{details}",
    fields: {
      appointment: "Termin",
      salon: "Salon",
      services: "Leistungen",
      technician: "Mitarbeiter/in",
      customer: "Kunde/Kundin",
      phone: "Telefon",
    },
  },
  el: {
    greeting: "Γεια σας! Για να κλείσετε ραντεβού, επισκεφθείτε: {website}",
    bookingConfirmed: "Το ραντεβού σας επιβεβαιώθηκε ✅\n{details}\nΚωδικός: {reference}",
    bookingCancelled:
      "Το ραντεβού σας ακυρώθηκε ❌\nΚωδικός: {reference}\nΓια νέα κράτηση, επισκεφθείτε: {website}",
    bookingNotCancellable:
      "Αυτή η κράτηση δεν μπορεί πλέον να ακυρωθεί. Ίσως έχει ήδη ακυρωθεί ή έχει ήδη ξεκινήσει.",
    bookingUnavailable:
      "Λυπούμαστε, αυτή η ώρα δεν είναι πλέον διαθέσιμη. Επισκεφθείτε το {website} για να επιλέξετε νέα ώρα.",
    cancelAction: "Ακύρωση",
    technicianConfirmed: "Νέα κράτηση επιβεβαιώθηκε ✅\n{details}",
    technicianCancelled: "Η κράτηση ακυρώθηκε ❌\n{details}",
    fields: {
      appointment: "Ραντεβού",
      salon: "Σαλόνι",
      services: "Υπηρεσίες",
      technician: "Τεχνίτης/τρια",
      customer: "Πελάτης",
      phone: "Τηλέφωνο",
    },
  },
  he: {
    greeting: "שלום! כדי לקבוע תור, בקרו ב: {website}",
    bookingConfirmed: "התור שלך אושר ✅\n{details}\nמספר אסמכתא: {reference}",
    bookingCancelled:
      "התור שלך בוטל ❌\nמספר אסמכתא: {reference}\nלקביעת תור נוסף, בקרו ב: {website}",
    bookingNotCancellable: "לא ניתן לבטל הזמנה זו. ייתכן שהיא כבר בוטלה או שכבר התחילה.",
    bookingUnavailable: "מצטערים, המועד הזה אינו זמין יותר. בקרו ב-{website} לבחירת מועד חדש.",
    cancelAction: "ביטול",
    technicianConfirmed: "הזמנה חדשה אושרה ✅\n{details}",
    technicianCancelled: "ההזמנה בוטלה ❌\n{details}",
    fields: {
      appointment: "תור",
      salon: "סלון",
      services: "טיפולים",
      technician: "טכנאי/ת",
      customer: "לקוח/ה",
      phone: "טלפון",
    },
  },
  hi: {
    greeting: "नमस्ते! अपॉइंटमेंट बुक करने के लिए कृपया विज़िट करें: {website}",
    bookingConfirmed: "आपकी अपॉइंटमेंट पुष्ट हो गई है ✅\n{details}\nसंदर्भ: {reference}",
    bookingCancelled:
      "आपकी अपॉइंटमेंट रद्द कर दी गई है ❌\nसंदर्भ: {reference}\nफिर से बुक करने के लिए विज़िट करें: {website}",
    bookingNotCancellable:
      "यह बुकिंग अब रद्द नहीं की जा सकती। यह पहले से रद्द हो सकती है या शुरू हो चुकी होगी।",
    bookingUnavailable: "क्षमा करें, यह समय अब उपलब्ध नहीं है। नया समय चुनने के लिए {website} पर जाएं।",
    cancelAction: "रद्द करें",
    technicianConfirmed: "नई बुकिंग पुष्ट हुई ✅\n{details}",
    technicianCancelled: "बुकिंग रद्द हुई ❌\n{details}",
    fields: {
      appointment: "अपॉइंटमेंट",
      salon: "सैलून",
      services: "सेवाएं",
      technician: "तकनीशियन",
      customer: "ग्राहक",
      phone: "फ़ोन",
    },
  },
  hu: {
    greeting: "Üdvözöljük! Időpont foglalásához kérjük, látogasson el ide: {website}",
    bookingConfirmed: "Az időpontja megerősítve ✅\n{details}\nHivatkozási szám: {reference}",
    bookingCancelled:
      "Az időpontját töröltük ❌\nHivatkozási szám: {reference}\nÚjra foglaláshoz látogasson el ide: {website}",
    bookingNotCancellable:
      "Ez a foglalás már nem törölhető. Lehet, hogy már törölték, vagy már elkezdődött.",
    bookingUnavailable:
      "Sajnáljuk, ez az időpont már nem elérhető. Válasszon új időpontot itt: {website}.",
    cancelAction: "Törlés",
    technicianConfirmed: "Új foglalás megerősítve ✅\n{details}",
    technicianCancelled: "Foglalás törölve ❌\n{details}",
    fields: {
      appointment: "Időpont",
      salon: "Szalon",
      services: "Szolgáltatások",
      technician: "Kezelő",
      customer: "Ügyfél",
      phone: "Telefon",
    },
  },
  id: {
    greeting: "Halo! Untuk membuat janji temu, silakan kunjungi: {website}",
    bookingConfirmed: "Janji temu Anda telah dikonfirmasi ✅\n{details}\nReferensi: {reference}",
    bookingCancelled:
      "Janji temu Anda telah dibatalkan ❌\nReferensi: {reference}\nUntuk memesan lagi, silakan kunjungi: {website}",
    bookingNotCancellable:
      "Pemesanan ini tidak dapat dibatalkan lagi. Mungkin sudah dibatalkan atau sudah dimulai.",
    bookingUnavailable:
      "Maaf, waktu tersebut sudah tidak tersedia. Silakan kunjungi {website} untuk memilih waktu baru.",
    cancelAction: "Batalkan",
    technicianConfirmed: "Pemesanan baru dikonfirmasi ✅\n{details}",
    technicianCancelled: "Pemesanan dibatalkan ❌\n{details}",
    fields: {
      appointment: "Janji Temu",
      salon: "Salon",
      services: "Layanan",
      technician: "Teknisi",
      customer: "Pelanggan",
      phone: "Telepon",
    },
  },
  it: {
    greeting: "Ciao! Per prenotare un appuntamento, visita: {website}",
    bookingConfirmed: "Il tuo appuntamento è confermato ✅\n{details}\nRiferimento: {reference}",
    bookingCancelled:
      "Il tuo appuntamento è stato annullato ❌\nRiferimento: {reference}\nPer prenotare di nuovo, visita: {website}",
    bookingNotCancellable:
      "Questa prenotazione non può più essere annullata. Potrebbe essere già stata annullata o già iniziata.",
    bookingUnavailable:
      "Siamo spiacenti, quell'orario non è più disponibile. Visita {website} per scegliere un nuovo orario.",
    cancelAction: "Annulla",
    technicianConfirmed: "Nuova prenotazione confermata ✅\n{details}",
    technicianCancelled: "Prenotazione annullata ❌\n{details}",
    fields: {
      appointment: "Appuntamento",
      salon: "Salone",
      services: "Servizi",
      technician: "Tecnico/a",
      customer: "Cliente",
      phone: "Telefono",
    },
  },
  ja: {
    greeting: "こんにちは！ご予約は以下からお願いします：{website}",
    bookingConfirmed: "ご予約が確定しました ✅\n{details}\n予約番号：{reference}",
    bookingCancelled:
      "ご予約はキャンセルされました ❌\n予約番号：{reference}\n再度ご予約の際はこちらへ：{website}",
    bookingNotCancellable: "このご予約はキャンセルできません。すでにキャンセル済みか、開始済みの可能性があります。",
    bookingUnavailable: "申し訳ございませんが、その時間はご予約いただけません。{website} から新しい時間をお選びください。",
    cancelAction: "キャンセル",
    technicianConfirmed: "新しい予約が確定しました ✅\n{details}",
    technicianCancelled: "予約がキャンセルされました ❌\n{details}",
    fields: {
      appointment: "予約時間",
      salon: "サロン",
      services: "サービス",
      technician: "担当者",
      customer: "お客様",
      phone: "電話番号",
    },
  },
  ko: {
    greeting: "안녕하세요! 예약을 원하시면 다음을 방문해 주세요: {website}",
    bookingConfirmed: "예약이 확정되었습니다 ✅\n{details}\n예약번호: {reference}",
    bookingCancelled:
      "예약이 취소되었습니다 ❌\n예약번호: {reference}\n다시 예약하시려면 방문해 주세요: {website}",
    bookingNotCancellable: "이 예약은 더 이상 취소할 수 없습니다. 이미 취소되었거나 시작되었을 수 있습니다.",
    bookingUnavailable:
      "죄송합니다. 해당 시간은 더 이상 이용할 수 없습니다. 새로운 시간을 선택하려면 {website}를 방문해 주세요.",
    cancelAction: "취소",
    technicianConfirmed: "새 예약이 확정되었습니다 ✅\n{details}",
    technicianCancelled: "예약이 취소되었습니다 ❌\n{details}",
    fields: {
      appointment: "예약 시간",
      salon: "살롱",
      services: "서비스",
      technician: "담당자",
      customer: "고객",
      phone: "전화번호",
    },
  },
  ms: {
    greeting: "Helo! Untuk membuat tempahan, sila layari: {website}",
    bookingConfirmed: "Tempahan anda telah disahkan ✅\n{details}\nRujukan: {reference}",
    bookingCancelled:
      "Tempahan anda telah dibatalkan ❌\nRujukan: {reference}\nUntuk menempah semula, sila layari: {website}",
    bookingNotCancellable:
      "Tempahan ini tidak boleh dibatalkan lagi. Ia mungkin telah dibatalkan atau telah bermula.",
    bookingUnavailable:
      "Maaf, masa tersebut tidak lagi tersedia. Sila layari {website} untuk memilih masa baharu.",
    cancelAction: "Batal",
    technicianConfirmed: "Tempahan baharu disahkan ✅\n{details}",
    technicianCancelled: "Tempahan dibatalkan ❌\n{details}",
    fields: {
      appointment: "Temujanji",
      salon: "Salon",
      services: "Perkhidmatan",
      technician: "Juruteknik",
      customer: "Pelanggan",
      phone: "Telefon",
    },
  },
  no: {
    greeting: "Hei! For å bestille en avtale, besøk: {website}",
    bookingConfirmed: "Avtalen din er bekreftet ✅\n{details}\nReferanse: {reference}",
    bookingCancelled:
      "Avtalen din er kansellert ❌\nReferanse: {reference}\nFor å bestille på nytt, besøk: {website}",
    bookingNotCancellable:
      "Denne bestillingen kan ikke lenger kanselleres. Den kan allerede være kansellert eller allerede ha startet.",
    bookingUnavailable:
      "Beklager, dette tidspunktet er ikke lenger tilgjengelig. Besøk {website} for å velge et nytt tidspunkt.",
    cancelAction: "Avbryt",
    technicianConfirmed: "Ny bestilling bekreftet ✅\n{details}",
    technicianCancelled: "Bestilling kansellert ❌\n{details}",
    fields: {
      appointment: "Avtale",
      salon: "Salong",
      services: "Behandlinger",
      technician: "Behandler",
      customer: "Kunde",
      phone: "Telefon",
    },
  },
  fa: {
    greeting: "سلام! برای رزرو وقت، لطفاً از این آدرس دیدن کنید: {website}",
    bookingConfirmed: "وقت شما تأیید شد ✅\n{details}\nشماره پیگیری: {reference}",
    bookingCancelled:
      "وقت شما لغو شد ❌\nشماره پیگیری: {reference}\nبرای رزرو دوباره، لطفاً از این آدرس دیدن کنید: {website}",
    bookingNotCancellable: "این رزرو دیگر قابل لغو نیست. ممکن است قبلاً لغو شده یا شروع شده باشد.",
    bookingUnavailable: "با عرض پوزش، این زمان دیگر در دسترس نیست. لطفاً برای انتخاب زمان جدید از {website} دیدن کنید.",
    cancelAction: "لغو",
    technicianConfirmed: "رزرو جدید تأیید شد ✅\n{details}",
    technicianCancelled: "رزرو لغو شد ❌\n{details}",
    fields: {
      appointment: "زمان قرار",
      salon: "سالن",
      services: "خدمات",
      technician: "متخصص",
      customer: "مشتری",
      phone: "تلفن",
    },
  },
  pl: {
    greeting: "Cześć! Aby zarezerwować wizytę, odwiedź: {website}",
    bookingConfirmed: "Twoja wizyta została potwierdzona ✅\n{details}\nNumer referencyjny: {reference}",
    bookingCancelled:
      "Twoja wizyta została odwołana ❌\nNumer referencyjny: {reference}\nAby zarezerwować ponownie, odwiedź: {website}",
    bookingNotCancellable:
      "Tej rezerwacji nie można już odwołać. Może już zostać odwołana lub już się rozpoczęła.",
    bookingUnavailable: "Przepraszamy, ten termin jest już niedostępny. Odwiedź {website}, aby wybrać nowy termin.",
    cancelAction: "Anuluj",
    technicianConfirmed: "Nowa rezerwacja potwierdzona ✅\n{details}",
    technicianCancelled: "Rezerwacja odwołana ❌\n{details}",
    fields: {
      appointment: "Termin",
      salon: "Salon",
      services: "Usługi",
      technician: "Specjalista",
      customer: "Klient",
      phone: "Telefon",
    },
  },
  pt: {
    greeting: "Olá! Para agendar um horário, visite: {website}",
    bookingConfirmed: "Seu agendamento foi confirmado ✅\n{details}\nReferência: {reference}",
    bookingCancelled:
      "Seu agendamento foi cancelado ❌\nReferência: {reference}\nPara agendar novamente, visite: {website}",
    bookingNotCancellable:
      "Este agendamento não pode mais ser cancelado. Pode já ter sido cancelado ou já ter começado.",
    bookingUnavailable:
      "Desculpe, esse horário não está mais disponível. Visite {website} para escolher um novo horário.",
    cancelAction: "Cancelar",
    technicianConfirmed: "Novo agendamento confirmado ✅\n{details}",
    technicianCancelled: "Agendamento cancelado ❌\n{details}",
    fields: {
      appointment: "Horário",
      salon: "Salão",
      services: "Serviços",
      technician: "Profissional",
      customer: "Cliente",
      phone: "Telefone",
    },
  },
  ro: {
    greeting: "Salut! Pentru a programa o vizită, te rugăm să vizitezi: {website}",
    bookingConfirmed: "Programarea ta a fost confirmată ✅\n{details}\nReferință: {reference}",
    bookingCancelled:
      "Programarea ta a fost anulată ❌\nReferință: {reference}\nPentru o nouă programare, vizitează: {website}",
    bookingNotCancellable:
      "Această programare nu mai poate fi anulată. Este posibil să fi fost deja anulată sau să fi început deja.",
    bookingUnavailable: "Ne pare rău, această oră nu mai este disponibilă. Vizitează {website} pentru a alege o nouă oră.",
    cancelAction: "Anulează",
    technicianConfirmed: "Programare nouă confirmată ✅\n{details}",
    technicianCancelled: "Programare anulată ❌\n{details}",
    fields: {
      appointment: "Programare",
      salon: "Salon",
      services: "Servicii",
      technician: "Specialist",
      customer: "Client",
      phone: "Telefon",
    },
  },
  ru: {
    greeting: "Здравствуйте! Чтобы записаться, посетите: {website}",
    bookingConfirmed: "Ваша запись подтверждена ✅\n{details}\nНомер записи: {reference}",
    bookingCancelled:
      "Ваша запись отменена ❌\nНомер записи: {reference}\nЧтобы записаться снова, посетите: {website}",
    bookingNotCancellable: "Эту запись больше нельзя отменить. Возможно, она уже отменена или уже началась.",
    bookingUnavailable: "Извините, это время больше недоступно. Пожалуйста, посетите {website}, чтобы выбрать новое время.",
    cancelAction: "Отменить",
    technicianConfirmed: "Новая запись подтверждена ✅\n{details}",
    technicianCancelled: "Запись отменена ❌\n{details}",
    fields: {
      appointment: "Время записи",
      salon: "Салон",
      services: "Услуги",
      technician: "Специалист",
      customer: "Клиент",
      phone: "Телефон",
    },
  },
  sk: {
    greeting: "Dobrý deň! Ak si chcete rezervovať termín, navštívte: {website}",
    bookingConfirmed: "Vaša rezervácia bola potvrdená ✅\n{details}\nČíslo rezervácie: {reference}",
    bookingCancelled:
      "Vaša rezervácia bola zrušená ❌\nČíslo rezervácie: {reference}\nPre novú rezerváciu navštívte: {website}",
    bookingNotCancellable: "Túto rezerváciu už nie je možné zrušiť. Možno už bola zrušená alebo už začala.",
    bookingUnavailable: "Prepáčte, tento čas už nie je k dispozícii. Nový čas si vyberte na {website}.",
    cancelAction: "Zrušiť",
    technicianConfirmed: "Nová rezervácia potvrdená ✅\n{details}",
    technicianCancelled: "Rezervácia zrušená ❌\n{details}",
    fields: {
      appointment: "Termín",
      salon: "Salón",
      services: "Služby",
      technician: "Technik",
      customer: "Klient",
      phone: "Telefón",
    },
  },
  es: {
    greeting: "¡Hola! Para reservar una cita, visita: {website}",
    bookingConfirmed: "Tu cita ha sido confirmada ✅\n{details}\nReferencia: {reference}",
    bookingCancelled:
      "Tu cita ha sido cancelada ❌\nReferencia: {reference}\nPara reservar de nuevo, visita: {website}",
    bookingNotCancellable:
      "Esta reserva ya no se puede cancelar. Puede que ya haya sido cancelada o que ya haya comenzado.",
    bookingUnavailable: "Lo sentimos, ese horario ya no está disponible. Visita {website} para elegir un nuevo horario.",
    cancelAction: "Cancelar",
    technicianConfirmed: "Nueva reserva confirmada ✅\n{details}",
    technicianCancelled: "Reserva cancelada ❌\n{details}",
    fields: {
      appointment: "Cita",
      salon: "Salón",
      services: "Servicios",
      technician: "Profesional",
      customer: "Cliente",
      phone: "Teléfono",
    },
  },
  sv: {
    greeting: "Hej! För att boka en tid, besök: {website}",
    bookingConfirmed: "Din bokning är bekräftad ✅\n{details}\nReferens: {reference}",
    bookingCancelled:
      "Din bokning har avbokats ❌\nReferens: {reference}\nFör att boka igen, besök: {website}",
    bookingNotCancellable:
      "Denna bokning kan inte längre avbokas. Den kan redan vara avbokad eller redan ha börjat.",
    bookingUnavailable: "Tyvärr, den tiden är inte längre tillgänglig. Besök {website} för att välja en ny tid.",
    cancelAction: "Avbryt",
    technicianConfirmed: "Ny bokning bekräftad ✅\n{details}",
    technicianCancelled: "Bokning avbokad ❌\n{details}",
    fields: {
      appointment: "Tid",
      salon: "Salong",
      services: "Behandlingar",
      technician: "Behandlare",
      customer: "Kund",
      phone: "Telefon",
    },
  },
  th: {
    greeting: "สวัสดีค่ะ/ครับ! หากต้องการจองนัดหมาย กรุณาเข้าชม: {website}",
    bookingConfirmed: "การนัดหมายของคุณได้รับการยืนยันแล้ว ✅\n{details}\nหมายเลขอ้างอิง: {reference}",
    bookingCancelled:
      "การนัดหมายของคุณถูกยกเลิกแล้ว ❌\nหมายเลขอ้างอิง: {reference}\nหากต้องการจองใหม่ กรุณาเข้าชม: {website}",
    bookingNotCancellable: "ไม่สามารถยกเลิกการจองนี้ได้อีกต่อไป อาจถูกยกเลิกไปแล้วหรือเริ่มไปแล้ว",
    bookingUnavailable: "ขออภัย ช่วงเวลานี้ไม่สามารถใช้ได้แล้ว กรุณาเข้าชม {website} เพื่อเลือกเวลาใหม่",
    cancelAction: "ยกเลิก",
    technicianConfirmed: "การจองใหม่ได้รับการยืนยัน ✅\n{details}",
    technicianCancelled: "การจองถูกยกเลิก ❌\n{details}",
    fields: {
      appointment: "เวลานัดหมาย",
      salon: "ร้าน",
      services: "บริการ",
      technician: "ช่างทำเล็บ",
      customer: "ลูกค้า",
      phone: "โทรศัพท์",
    },
  },
  tr: {
    greeting: "Merhaba! Randevu almak için lütfen ziyaret edin: {website}",
    bookingConfirmed: "Randevunuz onaylandı ✅\n{details}\nReferans: {reference}",
    bookingCancelled:
      "Randevunuz iptal edildi ❌\nReferans: {reference}\nYeniden randevu almak için ziyaret edin: {website}",
    bookingNotCancellable: "Bu randevu artık iptal edilemez. Zaten iptal edilmiş veya başlamış olabilir.",
    bookingUnavailable: "Üzgünüz, bu saat artık uygun değil. Yeni bir saat seçmek için {website} adresini ziyaret edin.",
    cancelAction: "İptal Et",
    technicianConfirmed: "Yeni randevu onaylandı ✅\n{details}",
    technicianCancelled: "Randevu iptal edildi ❌\n{details}",
    fields: {
      appointment: "Randevu",
      salon: "Salon",
      services: "Hizmetler",
      technician: "Uzman",
      customer: "Müşteri",
      phone: "Telefon",
    },
  },
  uk: {
    greeting: "Вітаємо! Щоб записатися, будь ласка, відвідайте: {website}",
    bookingConfirmed: "Ваш запис підтверджено ✅\n{details}\nНомер запису: {reference}",
    bookingCancelled:
      "Ваш запис скасовано ❌\nНомер запису: {reference}\nЩоб записатися знову, відвідайте: {website}",
    bookingNotCancellable:
      "Цей запис більше неможливо скасувати. Можливо, його вже скасовано або він уже розпочався.",
    bookingUnavailable: "На жаль, цей час більше недоступний. Будь ласка, відвідайте {website}, щоб обрати новий час.",
    cancelAction: "Скасувати",
    technicianConfirmed: "Новий запис підтверджено ✅\n{details}",
    technicianCancelled: "Запис скасовано ❌\n{details}",
    fields: {
      appointment: "Час запису",
      salon: "Салон",
      services: "Послуги",
      technician: "Спеціаліст",
      customer: "Клієнт",
      phone: "Телефон",
    },
  },
  ur: {
    greeting: "السلام علیکم! اپائنٹمنٹ بک کرنے کے لیے براہ کرم ملاحظہ کریں: {website}",
    bookingConfirmed: "آپ کی اپائنٹمنٹ کی تصدیق ہو گئی ہے ✅\n{details}\nحوالہ: {reference}",
    bookingCancelled:
      "آپ کی اپائنٹمنٹ منسوخ کر دی گئی ہے ❌\nحوالہ: {reference}\nدوبارہ بکنگ کے لیے ملاحظہ کریں: {website}",
    bookingNotCancellable:
      "یہ بکنگ مزید منسوخ نہیں کی جا سکتی۔ ممکن ہے یہ پہلے ہی منسوخ ہو چکی ہو یا شروع ہو چکی ہو۔",
    bookingUnavailable: "معذرت، یہ وقت مزید دستیاب نہیں ہے۔ نیا وقت منتخب کرنے کے لیے {website} ملاحظہ کریں۔",
    cancelAction: "منسوخ کریں",
    technicianConfirmed: "نئی بکنگ کی تصدیق ہو گئی ✅\n{details}",
    technicianCancelled: "بکنگ منسوخ کر دی گئی ❌\n{details}",
    fields: {
      appointment: "اپائنٹمنٹ",
      salon: "سیلون",
      services: "خدمات",
      technician: "ٹیکنیشن",
      customer: "گاہک",
      phone: "فون",
    },
  },
  vi: {
    greeting: "Xin chào! Để đặt lịch hẹn, vui lòng truy cập: {website}",
    bookingConfirmed: "Lịch hẹn của bạn đã được xác nhận ✅\n{details}\nMã tham chiếu: {reference}",
    bookingCancelled:
      "Lịch hẹn của bạn đã bị hủy ❌\nMã tham chiếu: {reference}\nĐể đặt lại, vui lòng truy cập: {website}",
    bookingNotCancellable: "Lịch hẹn này không thể hủy được nữa. Có thể đã bị hủy hoặc đã bắt đầu.",
    bookingUnavailable: "Rất tiếc, thời gian này không còn khả dụng. Vui lòng truy cập {website} để chọn thời gian mới.",
    cancelAction: "Hủy",
    technicianConfirmed: "Lịch hẹn mới đã được xác nhận ✅\n{details}",
    technicianCancelled: "Lịch hẹn đã bị hủy ❌\n{details}",
    fields: {
      appointment: "Lịch hẹn",
      salon: "Salon",
      services: "Dịch vụ",
      technician: "Kỹ thuật viên",
      customer: "Khách hàng",
      phone: "Điện thoại",
    },
  },
};

// organization_settings.bot_locale only has a loose length check in the
// database, so this must never throw: exact match, then the primary subtag
// (en-US -> en), then en. A subtag with no catalog entry of its own (e.g. the
// "zh" in zh-Hant-TW, since only zh-CN/zh-TW are real entries) falls to en
// rather than guessing a region.
export function resolveStaticMessages(locale: string): StaticMessageBundle {
  const exact = staticMessageCatalog[locale];
  if (exact) return exact;
  const primary = locale.split("-")[0];
  const bySubtag = staticMessageCatalog[primary];
  if (bySubtag) return bySubtag;
  return staticMessageCatalog.en;
}

export function formatStaticMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

// Shared composition for the {details} token used by booking/technician
// templates, so scripted-flow.ts and notifications.ts build it identically.
export function formatStaticDetails(
  fields: StaticMessageFields,
  values: {
    appointment: string;
    salon?: string | null;
    services?: string | null;
    technician?: string | null;
    customer: string;
    phone: string;
  },
): string {
  return [
    `${fields.appointment}: ${values.appointment}`,
    values.salon ? `${fields.salon}: ${values.salon}` : null,
    values.services ? `${fields.services}: ${values.services}` : null,
    values.technician ? `${fields.technician}: ${values.technician}` : null,
    `${fields.customer}: ${values.customer}`,
    `${fields.phone}: ${values.phone}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
