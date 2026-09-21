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
  checkinQrCaption: string;
  checkinDone: string;
  checkinAlready: string;
  activeBookingBlocked: string;
  updateAction: string;
  skipAction: string;
  updateApplied: string;
  updateUnavailable: string;
  skipAcknowledged: string;
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
    bookingNotCancellable:
      "لا يمكن إلغاء هذا الحجز الآن. قد يكون قد تم إلغاؤه مسبقًا أو بدأ الموعد.",
    bookingUnavailable: "عذرًا، هذا الوقت غير متاح الآن. يرجى زيارة {website} لاختيار وقت جديد.",
    cancelAction: "إلغاء",
    checkinQrCaption: "اعرض رمز QR هذا على فريق الصالون عند الوصول لتسجيل الحضور ✅",
    checkinDone: "تم تسجيل الحضور ✅\n{customer}\n{appointment}",
    checkinAlready: "تم تسجيل الحضور لهذا الموعد مسبقًا ✅",
    activeBookingBlocked: "لديك موعد نشط حاليًا\n{appointment}\nهل تريد تحديثه أم تجاهل هذا الطلب؟",
    updateAction: "تحديث",
    skipAction: "تجاهل",
    updateApplied: "تم تحديث موعدك ✅\n{appointment}",
    updateUnavailable: "عذرًا، لا يمكن تحديث هذا الموعد الآن.",
    skipAcknowledged: "لم يتم إجراء أي تغييرات. موعدك كما هو.",
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
    bookingUnavailable:
      "দুঃখিত, এই সময়টি আর উপলব্ধ নেই। নতুন সময় বেছে নিতে {website} ভিজিট করুন।",
    cancelAction: "বাতিল করুন",
    checkinQrCaption: "চেক-ইন করার জন্য সেলুন স্টাফকে এই QR কোডটি দেখান ✅",
    checkinDone: "চেক-ইন সম্পন্ন হয়েছে ✅\n{customer}\n{appointment}",
    checkinAlready: "এই বুকিং ইতিমধ্যে চেক-ইন করা হয়েছে ✅",
    activeBookingBlocked:
      "আপনার একটি সক্রিয় বুকিং রয়েছে\n{appointment}\nআপনি এটি আপডেট করতে চান নাকি এই অনুরোধটি এড়িয়ে যেতে চান?",
    updateAction: "আপডেট করুন",
    skipAction: "এড়িয়ে যান",
    updateApplied: "আপনার বুকিং আপডেট করা হয়েছে ✅\n{appointment}",
    updateUnavailable: "দুঃখিত, এই বুকিং আর আপডেট করা যাবে না।",
    skipAcknowledged: "কোনো পরিবর্তন করা হয়নি। আপনার বুকিং অপরিবর্তিত রয়েছে।",
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
    checkinQrCaption: "到店后请向店员出示此二维码以签到 ✅",
    checkinDone: "签到成功 ✅\n{customer}\n{appointment}",
    checkinAlready: "该预约已经签到 ✅",
    activeBookingBlocked: "您已有一个有效预约\n{appointment}\n您想更新该预约还是跳过此请求？",
    updateAction: "更新预约",
    skipAction: "跳过",
    updateApplied: "您的预约已更新 ✅\n{appointment}",
    updateUnavailable: "抱歉，此预约无法再更新。",
    skipAcknowledged: "未做任何更改，您的预约保持不变。",
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
    checkinQrCaption: "抵達後請向店員出示此QR code以完成報到 ✅",
    checkinDone: "報到成功 ✅\n{customer}\n{appointment}",
    checkinAlready: "此預約已經報到過 ✅",
    activeBookingBlocked:
      "您目前已有一筆有效預約\n{appointment}\n您想要更新此預約，還是跳過這次請求？",
    updateAction: "更新預約",
    skipAction: "跳過",
    updateApplied: "您的預約已更新 ✅\n{appointment}",
    updateUnavailable: "抱歉，此預約已無法更新。",
    skipAcknowledged: "未做任何變更，您的預約維持原狀。",
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
    bookingNotCancellable:
      "Tuto rezervaci již nelze zrušit. Možná byla již zrušena nebo již začala.",
    bookingUnavailable:
      "Omlouváme se, tento čas již není k dispozici. Nový čas vyberte na {website}.",
    cancelAction: "Zrušit",
    checkinQrCaption: "Ukažte tento QR kód personálu salonu pro registraci příchodu ✅",
    checkinDone: "Příchod zaznamenán ✅\n{customer}\n{appointment}",
    checkinAlready: "Příchod pro tuto rezervaci již byl zaznamenán ✅",
    activeBookingBlocked:
      "Již máte aktivní rezervaci\n{appointment}\nChcete ji aktualizovat, nebo tento požadavek přeskočit?",
    updateAction: "Aktualizovat",
    skipAction: "Přeskočit",
    updateApplied: "Vaše rezervace byla aktualizována ✅\n{appointment}",
    updateUnavailable: "Bohužel tuto rezervaci již nelze aktualizovat.",
    skipAcknowledged: "Nebyly provedeny žádné změny. Vaše rezervace zůstává stejná.",
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
    checkinQrCaption: "Vis denne QR-kode til personalet, når du ankommer, for at tjekke ind ✅",
    checkinDone: "Tjekket ind ✅\n{customer}\n{appointment}",
    checkinAlready: "Der er allerede tjekket ind på denne booking ✅",
    activeBookingBlocked:
      "Du har allerede en aktiv booking\n{appointment}\nVil du opdatere den, eller springe denne anmodning over?",
    updateAction: "Opdater",
    skipAction: "Spring over",
    updateApplied: "Din booking er blevet opdateret ✅\n{appointment}",
    updateUnavailable: "Beklager, denne booking kan ikke længere opdateres.",
    skipAcknowledged: "Ingen ændringer foretaget. Din booking forbliver som den er.",
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
    checkinQrCaption: "Toon deze QR-code aan het personeel bij aankomst om in te checken ✅",
    checkinDone: "Ingecheckt ✅\n{customer}\n{appointment}",
    checkinAlready: "Er is al ingecheckt voor deze afspraak ✅",
    activeBookingBlocked:
      "Je hebt al een actieve afspraak\n{appointment}\nWil je deze bijwerken of dit verzoek overslaan?",
    updateAction: "Bijwerken",
    skipAction: "Overslaan",
    updateApplied: "Je afspraak is bijgewerkt ✅\n{appointment}",
    updateUnavailable: "Sorry, deze afspraak kan niet meer worden bijgewerkt.",
    skipAcknowledged: "Er zijn geen wijzigingen aangebracht. Je afspraak blijft ongewijzigd.",
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
    checkinQrCaption: "Show this QR code to salon staff when you arrive to check in ✅",
    checkinDone: "Checked in ✅\n{customer}\n{appointment}",
    checkinAlready: "This booking was already checked in ✅",
    activeBookingBlocked:
      "You already have an active booking\n{appointment}\nWould you like to update it or skip this request?",
    updateAction: "Update booking",
    skipAction: "Skip",
    updateApplied: "Your booking has been updated ✅\n{appointment}",
    updateUnavailable: "Sorry, this booking can no longer be updated.",
    skipAcknowledged: "No changes made. Your booking stays as is.",
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
    checkinQrCaption: "Näytä tämä QR-koodi henkilökunnalle saapuessasi kirjautuaksesi sisään ✅",
    checkinDone: "Sisäänkirjaus tehty ✅\n{customer}\n{appointment}",
    checkinAlready: "Tähän varaukseen on jo kirjauduttu sisään ✅",
    activeBookingBlocked:
      "Sinulla on jo aktiivinen varaus\n{appointment}\nHaluatko päivittää sen vai ohittaa tämän pyynnön?",
    updateAction: "Päivitä",
    skipAction: "Ohita",
    updateApplied: "Varauksesi on päivitetty ✅\n{appointment}",
    updateUnavailable: "Valitettavasti tätä varausta ei voi enää päivittää.",
    skipAcknowledged: "Muutoksia ei tehty. Varauksesi pysyy ennallaan.",
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
    checkinQrCaption:
      "Montrez ce code QR au personnel du salon à votre arrivée pour enregistrer votre venue ✅",
    checkinDone: "Enregistrement effectué ✅\n{customer}\n{appointment}",
    checkinAlready: "L'enregistrement a déjà été effectué pour ce rendez-vous ✅",
    activeBookingBlocked:
      "Vous avez déjà un rendez-vous actif\n{appointment}\nSouhaitez-vous le modifier ou ignorer cette demande ?",
    updateAction: "Modifier",
    skipAction: "Ignorer",
    updateApplied: "Votre rendez-vous a été mis à jour ✅\n{appointment}",
    updateUnavailable: "Désolé, ce rendez-vous ne peut plus être modifié.",
    skipAcknowledged: "Aucune modification effectuée. Votre rendez-vous reste inchangé.",
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
    checkinQrCaption:
      "Zeigen Sie diesen QR-Code bei Ihrer Ankunft dem Personal, um sich einzuchecken ✅",
    checkinDone: "Eingecheckt ✅\n{customer}\n{appointment}",
    checkinAlready: "Für diesen Termin wurde bereits eingecheckt ✅",
    activeBookingBlocked:
      "Sie haben bereits einen aktiven Termin\n{appointment}\nMöchten Sie ihn aktualisieren oder diese Anfrage überspringen?",
    updateAction: "Aktualisieren",
    skipAction: "Überspringen",
    updateApplied: "Ihr Termin wurde aktualisiert ✅\n{appointment}",
    updateUnavailable: "Entschuldigung, dieser Termin kann nicht mehr aktualisiert werden.",
    skipAcknowledged: "Es wurden keine Änderungen vorgenommen. Ihr Termin bleibt unverändert.",
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
    checkinQrCaption:
      "Δείξτε αυτόν τον κωδικό QR στο προσωπικό του σαλονιού κατά την άφιξή σας για check-in ✅",
    checkinDone: "Το check-in ολοκληρώθηκε ✅\n{customer}\n{appointment}",
    checkinAlready: "Έχει ήδη γίνει check-in για αυτό το ραντεβού ✅",
    activeBookingBlocked:
      "Έχετε ήδη ένα ενεργό ραντεβού\n{appointment}\nΘέλετε να το ενημερώσετε ή να αγνοήσετε αυτό το αίτημα;",
    updateAction: "Ενημέρωση",
    skipAction: "Παράλειψη",
    updateApplied: "Το ραντεβού σας ενημερώθηκε ✅\n{appointment}",
    updateUnavailable: "Λυπούμαστε, αυτό το ραντεβού δεν μπορεί να ενημερωθεί πλέον.",
    skipAcknowledged: "Δεν έγινε καμία αλλαγή. Το ραντεβού σας παραμένει ως έχει.",
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
    checkinQrCaption: "הציגו קוד QR זה לצוות הסלון בהגעתכם לביצוע צ'ק-אין ✅",
    checkinDone: "בוצע צ'ק-אין ✅\n{customer}\n{appointment}",
    checkinAlready: "בוצע כבר צ'ק-אין לתור זה ✅",
    activeBookingBlocked:
      "יש לך תור פעיל\n{appointment}\nהאם תרצה לעדכן אותו או להתעלם מהבקשה הזו?",
    updateAction: "עדכון",
    skipAction: "דלג",
    updateApplied: "התור שלך עודכן ✅\n{appointment}",
    updateUnavailable: "מצטערים, לא ניתן לעדכן תור זה יותר.",
    skipAcknowledged: "לא בוצעו שינויים. התור שלך נשאר ללא שינוי.",
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
    bookingUnavailable:
      "क्षमा करें, यह समय अब उपलब्ध नहीं है। नया समय चुनने के लिए {website} पर जाएं।",
    cancelAction: "रद्द करें",
    checkinQrCaption: "चेक-इन के लिए पहुंचने पर यह QR कोड सैलून स्टाफ को दिखाएं ✅",
    checkinDone: "चेक-इन हो गया ✅\n{customer}\n{appointment}",
    checkinAlready: "इस बुकिंग के लिए पहले ही चेक-इन हो चुका है ✅",
    activeBookingBlocked:
      "आपकी एक सक्रिय बुकिंग पहले से मौजूद है\n{appointment}\nक्या आप इसे अपडेट करना चाहेंगे या इस अनुरोध को छोड़ना चाहेंगे?",
    updateAction: "अपडेट करें",
    skipAction: "छोड़ें",
    updateApplied: "आपकी बुकिंग अपडेट कर दी गई है ✅\n{appointment}",
    updateUnavailable: "क्षमा करें, यह बुकिंग अब अपडेट नहीं की जा सकती।",
    skipAcknowledged: "कोई बदलाव नहीं किया गया। आपकी बुकिंग पहले जैसी ही है।",
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
    checkinQrCaption:
      "Érkezéskor mutassa meg ezt a QR-kódot a szalon személyzetének a bejelentkezéshez ✅",
    checkinDone: "Bejelentkezve ✅\n{customer}\n{appointment}",
    checkinAlready: "Ehhez a foglaláshoz már megtörtént a bejelentkezés ✅",
    activeBookingBlocked:
      "Már van egy aktív foglalása\n{appointment}\nSzeretné frissíteni, vagy kihagyja ezt a kérést?",
    updateAction: "Frissítés",
    skipAction: "Kihagyás",
    updateApplied: "Az időpontja frissítve lett ✅\n{appointment}",
    updateUnavailable: "Sajnáljuk, ez a foglalás már nem frissíthető.",
    skipAcknowledged: "Nem történt módosítás. Az időpontja változatlan marad.",
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
    checkinQrCaption: "Tunjukkan kode QR ini kepada staf salon saat Anda tiba untuk check-in ✅",
    checkinDone: "Check-in berhasil ✅\n{customer}\n{appointment}",
    checkinAlready: "Janji temu ini sudah check-in ✅",
    activeBookingBlocked:
      "Anda sudah memiliki janji temu aktif\n{appointment}\nApakah Anda ingin memperbaruinya atau melewati permintaan ini?",
    updateAction: "Perbarui",
    skipAction: "Lewati",
    updateApplied: "Janji temu Anda telah diperbarui ✅\n{appointment}",
    updateUnavailable: "Maaf, janji temu ini tidak dapat diperbarui lagi.",
    skipAcknowledged: "Tidak ada perubahan yang dilakukan. Janji temu Anda tetap sama.",
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
    checkinQrCaption:
      "Mostra questo codice QR al personale del salone al tuo arrivo per il check-in ✅",
    checkinDone: "Check-in effettuato ✅\n{customer}\n{appointment}",
    checkinAlready: "Il check-in per questo appuntamento è già stato effettuato ✅",
    activeBookingBlocked:
      "Hai già un appuntamento attivo\n{appointment}\nVuoi aggiornarlo o ignorare questa richiesta?",
    updateAction: "Aggiorna",
    skipAction: "Salta",
    updateApplied: "Il tuo appuntamento è stato aggiornato ✅\n{appointment}",
    updateUnavailable: "Siamo spiacenti, questo appuntamento non può più essere aggiornato.",
    skipAcknowledged: "Nessuna modifica effettuata. Il tuo appuntamento resta invariato.",
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
    bookingNotCancellable:
      "このご予約はキャンセルできません。すでにキャンセル済みか、開始済みの可能性があります。",
    bookingUnavailable:
      "申し訳ございませんが、その時間はご予約いただけません。{website} から新しい時間をお選びください。",
    cancelAction: "キャンセル",
    checkinQrCaption:
      "ご来店時にこのQRコードをスタッフにご提示いただき、チェックインをお願いします ✅",
    checkinDone: "チェックインが完了しました ✅\n{customer}\n{appointment}",
    checkinAlready: "このご予約は既にチェックイン済みです ✅",
    activeBookingBlocked:
      "現在有効なご予約があります\n{appointment}\nこのご予約を更新しますか、それともこのリクエストを無視しますか？",
    updateAction: "更新する",
    skipAction: "スキップ",
    updateApplied: "ご予約が更新されました ✅\n{appointment}",
    updateUnavailable: "申し訳ございませんが、このご予約は更新できません。",
    skipAcknowledged: "変更は行われませんでした。ご予約はそのままです。",
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
    bookingNotCancellable:
      "이 예약은 더 이상 취소할 수 없습니다. 이미 취소되었거나 시작되었을 수 있습니다.",
    bookingUnavailable:
      "죄송합니다. 해당 시간은 더 이상 이용할 수 없습니다. 새로운 시간을 선택하려면 {website}를 방문해 주세요.",
    cancelAction: "취소",
    checkinQrCaption: "도착하시면 이 QR코드를 직원에게 보여주시고 체크인해 주세요 ✅",
    checkinDone: "체크인 완료 ✅\n{customer}\n{appointment}",
    checkinAlready: "이 예약은 이미 체크인되었습니다 ✅",
    activeBookingBlocked:
      "이미 활성화된 예약이 있습니다\n{appointment}\n예약을 업데이트하시겠습니까, 아니면 이 요청을 건너뛰시겠습니까?",
    updateAction: "업데이트",
    skipAction: "건너뛰기",
    updateApplied: "예약이 업데이트되었습니다 ✅\n{appointment}",
    updateUnavailable: "죄송합니다. 이 예약은 더 이상 업데이트할 수 없습니다.",
    skipAcknowledged: "변경 사항이 없습니다. 예약은 그대로 유지됩니다.",
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
    checkinQrCaption:
      "Tunjukkan kod QR ini kepada staf salon semasa anda tiba untuk daftar masuk ✅",
    checkinDone: "Daftar masuk berjaya ✅\n{customer}\n{appointment}",
    checkinAlready: "Tempahan ini sudah didaftar masuk ✅",
    activeBookingBlocked:
      "Anda sudah mempunyai tempahan aktif\n{appointment}\nAdakah anda mahu mengemas kininya atau melangkau permintaan ini?",
    updateAction: "Kemas kini",
    skipAction: "Langkau",
    updateApplied: "Tempahan anda telah dikemas kini ✅\n{appointment}",
    updateUnavailable: "Maaf, tempahan ini tidak boleh dikemas kini lagi.",
    skipAcknowledged: "Tidak ada perubahan dibuat. Tempahan anda kekal sama.",
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
    checkinQrCaption: "Vis denne QR-koden til personalet når du kommer for å sjekke inn ✅",
    checkinDone: "Sjekket inn ✅\n{customer}\n{appointment}",
    checkinAlready: "Det er allerede sjekket inn på denne bestillingen ✅",
    activeBookingBlocked:
      "Du har allerede en aktiv bestilling\n{appointment}\nVil du oppdatere den, eller hoppe over denne forespørselen?",
    updateAction: "Oppdater",
    skipAction: "Hopp over",
    updateApplied: "Bestillingen din er oppdatert ✅\n{appointment}",
    updateUnavailable: "Beklager, denne bestillingen kan ikke lenger oppdateres.",
    skipAcknowledged: "Ingen endringer ble gjort. Bestillingen din forblir som den er.",
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
    bookingUnavailable:
      "با عرض پوزش، این زمان دیگر در دسترس نیست. لطفاً برای انتخاب زمان جدید از {website} دیدن کنید.",
    cancelAction: "لغو",
    checkinQrCaption: "هنگام ورود، این کد QR را به کارکنان سالن نشان دهید تا حضور شما ثبت شود ✅",
    checkinDone: "ورود ثبت شد ✅\n{customer}\n{appointment}",
    checkinAlready: "ورود برای این رزرو قبلاً ثبت شده است ✅",
    activeBookingBlocked:
      "شما در حال حاضر یک رزرو فعال دارید\n{appointment}\nآیا می‌خواهید آن را به‌روزرسانی کنید یا این درخواست را نادیده بگیرید؟",
    updateAction: "به‌روزرسانی",
    skipAction: "رد کردن",
    updateApplied: "رزرو شما به‌روزرسانی شد ✅\n{appointment}",
    updateUnavailable: "با عرض پوزش، این رزرو دیگر قابل به‌روزرسانی نیست.",
    skipAcknowledged: "هیچ تغییری اعمال نشد. رزرو شما بدون تغییر باقی می‌ماند.",
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
    bookingConfirmed:
      "Twoja wizyta została potwierdzona ✅\n{details}\nNumer referencyjny: {reference}",
    bookingCancelled:
      "Twoja wizyta została odwołana ❌\nNumer referencyjny: {reference}\nAby zarezerwować ponownie, odwiedź: {website}",
    bookingNotCancellable:
      "Tej rezerwacji nie można już odwołać. Może już zostać odwołana lub już się rozpoczęła.",
    bookingUnavailable:
      "Przepraszamy, ten termin jest już niedostępny. Odwiedź {website}, aby wybrać nowy termin.",
    cancelAction: "Anuluj",
    checkinQrCaption:
      "Pokaż ten kod QR personelowi salonu po przybyciu, aby zarejestrować wizytę ✅",
    checkinDone: "Zarejestrowano przybycie ✅\n{customer}\n{appointment}",
    checkinAlready: "Przybycie na tę wizytę zostało już zarejestrowane ✅",
    activeBookingBlocked:
      "Masz już aktywną wizytę\n{appointment}\nChcesz ją zaktualizować, czy pominąć tę prośbę?",
    updateAction: "Aktualizuj",
    skipAction: "Pomiń",
    updateApplied: "Twoja wizyta została zaktualizowana ✅\n{appointment}",
    updateUnavailable: "Przepraszamy, tej wizyty nie można już zaktualizować.",
    skipAcknowledged: "Nie wprowadzono żadnych zmian. Twoja wizyta pozostaje bez zmian.",
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
    checkinQrCaption: "Mostre este código QR à equipe do salão ao chegar para fazer check-in ✅",
    checkinDone: "Check-in realizado ✅\n{customer}\n{appointment}",
    checkinAlready: "O check-in já foi realizado para este agendamento ✅",
    activeBookingBlocked:
      "Você já tem um agendamento ativo\n{appointment}\nDeseja atualizá-lo ou ignorar esta solicitação?",
    updateAction: "Atualizar",
    skipAction: "Ignorar",
    updateApplied: "Seu agendamento foi atualizado ✅\n{appointment}",
    updateUnavailable: "Desculpe, este agendamento não pode mais ser atualizado.",
    skipAcknowledged: "Nenhuma alteração foi feita. Seu agendamento permanece o mesmo.",
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
    bookingUnavailable:
      "Ne pare rău, această oră nu mai este disponibilă. Vizitează {website} pentru a alege o nouă oră.",
    cancelAction: "Anulează",
    checkinQrCaption: "Arată acest cod QR personalului salonului la sosire pentru check-in ✅",
    checkinDone: "Check-in efectuat ✅\n{customer}\n{appointment}",
    checkinAlready: "Check-in-ul pentru această programare a fost deja efectuat ✅",
    activeBookingBlocked:
      "Ai deja o programare activă\n{appointment}\nVrei să o actualizezi sau să ignori această cerere?",
    updateAction: "Actualizează",
    skipAction: "Omite",
    updateApplied: "Programarea ta a fost actualizată ✅\n{appointment}",
    updateUnavailable: "Ne pare rău, această programare nu mai poate fi actualizată.",
    skipAcknowledged: "Nu s-au făcut modificări. Programarea ta rămâne neschimbată.",
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
    bookingNotCancellable:
      "Эту запись больше нельзя отменить. Возможно, она уже отменена или уже началась.",
    bookingUnavailable:
      "Извините, это время больше недоступно. Пожалуйста, посетите {website}, чтобы выбрать новое время.",
    cancelAction: "Отменить",
    checkinQrCaption:
      "Покажите этот QR-код персоналу салона при приходе, чтобы зарегистрироваться ✅",
    checkinDone: "Регистрация выполнена ✅\n{customer}\n{appointment}",
    checkinAlready: "Регистрация для этой записи уже выполнена ✅",
    activeBookingBlocked:
      "У вас уже есть активная запись\n{appointment}\nВы хотите обновить её или пропустить этот запрос?",
    updateAction: "Изменить",
    skipAction: "Пропустить",
    updateApplied: "Ваша запись обновлена ✅\n{appointment}",
    updateUnavailable: "Извините, эту запись больше нельзя обновить.",
    skipAcknowledged: "Изменений не было внесено. Ваша запись остаётся прежней.",
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
    bookingNotCancellable:
      "Túto rezerváciu už nie je možné zrušiť. Možno už bola zrušená alebo už začala.",
    bookingUnavailable:
      "Prepáčte, tento čas už nie je k dispozícii. Nový čas si vyberte na {website}.",
    cancelAction: "Zrušiť",
    checkinQrCaption:
      "Pri príchode ukážte tento QR kód personálu salónu na registráciu príchodu ✅",
    checkinDone: "Príchod zaregistrovaný ✅\n{customer}\n{appointment}",
    checkinAlready: "Príchod na túto rezerváciu už bol zaregistrovaný ✅",
    activeBookingBlocked:
      "Už máte aktívnu rezerváciu\n{appointment}\nChcete ju aktualizovať, alebo túto požiadavku preskočiť?",
    updateAction: "Aktualizovať",
    skipAction: "Preskočiť",
    updateApplied: "Vaša rezervácia bola aktualizovaná ✅\n{appointment}",
    updateUnavailable: "Prepáčte, túto rezerváciu už nie je možné aktualizovať.",
    skipAcknowledged: "Neboli vykonané žiadne zmeny. Vaša rezervácia zostáva rovnaká.",
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
    bookingUnavailable:
      "Lo sentimos, ese horario ya no está disponible. Visita {website} para elegir un nuevo horario.",
    cancelAction: "Cancelar",
    checkinQrCaption:
      "Muestra este código QR al personal del salón al llegar para registrar tu entrada ✅",
    checkinDone: "Registro de entrada completado ✅\n{customer}\n{appointment}",
    checkinAlready: "Ya se registró la entrada para esta cita ✅",
    activeBookingBlocked:
      "Ya tienes una cita activa\n{appointment}\n¿Deseas actualizarla u omitir esta solicitud?",
    updateAction: "Actualizar",
    skipAction: "Omitir",
    updateApplied: "Tu cita ha sido actualizada ✅\n{appointment}",
    updateUnavailable: "Lo sentimos, esta cita ya no se puede actualizar.",
    skipAcknowledged: "No se realizaron cambios. Tu cita permanece igual.",
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
    bookingUnavailable:
      "Tyvärr, den tiden är inte längre tillgänglig. Besök {website} för att välja en ny tid.",
    cancelAction: "Avbryt",
    checkinQrCaption: "Visa denna QR-kod för personalen när du anländer för att checka in ✅",
    checkinDone: "Incheckad ✅\n{customer}\n{appointment}",
    checkinAlready: "Incheckning för denna bokning har redan gjorts ✅",
    activeBookingBlocked:
      "Du har redan en aktiv bokning\n{appointment}\nVill du uppdatera den, eller hoppa över den här begäran?",
    updateAction: "Uppdatera",
    skipAction: "Hoppa över",
    updateApplied: "Din bokning har uppdaterats ✅\n{appointment}",
    updateUnavailable: "Tyvärr kan denna bokning inte längre uppdateras.",
    skipAcknowledged: "Inga ändringar gjordes. Din bokning förblir densamma.",
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
    bookingConfirmed:
      "การนัดหมายของคุณได้รับการยืนยันแล้ว ✅\n{details}\nหมายเลขอ้างอิง: {reference}",
    bookingCancelled:
      "การนัดหมายของคุณถูกยกเลิกแล้ว ❌\nหมายเลขอ้างอิง: {reference}\nหากต้องการจองใหม่ กรุณาเข้าชม: {website}",
    bookingNotCancellable: "ไม่สามารถยกเลิกการจองนี้ได้อีกต่อไป อาจถูกยกเลิกไปแล้วหรือเริ่มไปแล้ว",
    bookingUnavailable:
      "ขออภัย ช่วงเวลานี้ไม่สามารถใช้ได้แล้ว กรุณาเข้าชม {website} เพื่อเลือกเวลาใหม่",
    cancelAction: "ยกเลิก",
    checkinQrCaption: "แสดง QR โค้ดนี้ให้พนักงานร้านเมื่อคุณมาถึงเพื่อเช็คอิน ✅",
    checkinDone: "เช็คอินสำเร็จ ✅\n{customer}\n{appointment}",
    checkinAlready: "การนัดหมายนี้เช็คอินไปแล้ว ✅",
    activeBookingBlocked:
      "คุณมีการนัดหมายที่ใช้งานอยู่แล้ว\n{appointment}\nคุณต้องการอัปเดตหรือข้ามคำขอนี้?",
    updateAction: "อัปเดต",
    skipAction: "ข้าม",
    updateApplied: "การนัดหมายของคุณได้รับการอัปเดตแล้ว ✅\n{appointment}",
    updateUnavailable: "ขออภัย ไม่สามารถอัปเดตการนัดหมายนี้ได้อีกต่อไป",
    skipAcknowledged: "ไม่มีการเปลี่ยนแปลงใดๆ การนัดหมายของคุณยังเหมือนเดิม",
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
    bookingNotCancellable:
      "Bu randevu artık iptal edilemez. Zaten iptal edilmiş veya başlamış olabilir.",
    bookingUnavailable:
      "Üzgünüz, bu saat artık uygun değil. Yeni bir saat seçmek için {website} adresini ziyaret edin.",
    cancelAction: "İptal Et",
    checkinQrCaption: "Geldiğinizde giriş yapmak için bu QR kodunu salon personeline gösterin ✅",
    checkinDone: "Giriş yapıldı ✅\n{customer}\n{appointment}",
    checkinAlready: "Bu randevu için giriş zaten yapılmış ✅",
    activeBookingBlocked:
      "Zaten aktif bir randevunuz var\n{appointment}\nBunu güncellemek mi istersiniz yoksa bu isteği atlamak mı istersiniz?",
    updateAction: "Güncelle",
    skipAction: "Atla",
    updateApplied: "Randevunuz güncellendi ✅\n{appointment}",
    updateUnavailable: "Üzgünüz, bu randevu artık güncellenemez.",
    skipAcknowledged: "Herhangi bir değişiklik yapılmadı. Randevunuz aynı kalıyor.",
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
    bookingUnavailable:
      "На жаль, цей час більше недоступний. Будь ласка, відвідайте {website}, щоб обрати новий час.",
    cancelAction: "Скасувати",
    checkinQrCaption:
      "Покажіть цей QR-код персоналу салону під час приходу, щоб зареєструватися ✅",
    checkinDone: "Реєстрацію завершено ✅\n{customer}\n{appointment}",
    checkinAlready: "Реєстрація для цього запису вже відбулася ✅",
    activeBookingBlocked:
      "У вас вже є активний запис\n{appointment}\nБажаєте оновити його чи пропустити цей запит?",
    updateAction: "Змінити",
    skipAction: "Пропустити",
    updateApplied: "Ваш запис оновлено ✅\n{appointment}",
    updateUnavailable: "На жаль, цей запис більше не можна оновити.",
    skipAcknowledged: "Змін не внесено. Ваш запис залишається без змін.",
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
    bookingUnavailable:
      "معذرت، یہ وقت مزید دستیاب نہیں ہے۔ نیا وقت منتخب کرنے کے لیے {website} ملاحظہ کریں۔",
    cancelAction: "منسوخ کریں",
    checkinQrCaption: "پہنچنے پر چیک ان کے لیے یہ QR کوڈ سیلون کے عملے کو دکھائیں ✅",
    checkinDone: "چیک ان مکمل ہوگیا ✅\n{customer}\n{appointment}",
    checkinAlready: "اس بکنگ کے لیے پہلے ہی چیک ان ہو چکا ہے ✅",
    activeBookingBlocked:
      "آپ کی پہلے سے ایک فعال بکنگ موجود ہے\n{appointment}\nکیا آپ اسے اپڈیٹ کرنا چاہتے ہیں یا اس درخواست کو نظر انداز کرنا چاہتے ہیں؟",
    updateAction: "اپڈیٹ کریں",
    skipAction: "نظر انداز کریں",
    updateApplied: "آپ کی بکنگ اپڈیٹ کر دی گئی ہے ✅\n{appointment}",
    updateUnavailable: "معذرت، یہ بکنگ مزید اپڈیٹ نہیں کی جا سکتی۔",
    skipAcknowledged: "کوئی تبدیلی نہیں کی گئی۔ آپ کی بکنگ ویسی ہی ہے۔",
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
    bookingUnavailable:
      "Rất tiếc, thời gian này không còn khả dụng. Vui lòng truy cập {website} để chọn thời gian mới.",
    cancelAction: "Hủy",
    checkinQrCaption: "Xuất trình mã QR này cho nhân viên salon khi đến để check-in ✅",
    checkinDone: "Đã check-in ✅\n{customer}\n{appointment}",
    checkinAlready: "Lịch hẹn này đã được check-in trước đó ✅",
    activeBookingBlocked:
      "Bạn đã có một lịch hẹn đang hoạt động\n{appointment}\nBạn muốn cập nhật lịch hẹn này hay bỏ qua yêu cầu này?",
    updateAction: "Cập nhật",
    skipAction: "Bỏ qua",
    updateApplied: "Lịch hẹn của bạn đã được cập nhật ✅\n{appointment}",
    updateUnavailable: "Rất tiếc, lịch hẹn này không thể cập nhật được nữa.",
    skipAcknowledged: "Không có thay đổi nào được thực hiện. Lịch hẹn của bạn vẫn giữ nguyên.",
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
