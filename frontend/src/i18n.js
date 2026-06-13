import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Appearance": "Appearance",
      "Language": "Language",
      "Light": "Light",
      "Dark": "Dark",
      "Local Alerts": "Local Alerts",
      "Joined Circles": "Joined Circles",
      "My Bookings": "My Bookings",
      "Health & Activity": "Health & Activity",
      "Recent Activity": "Recent Activity",
      "Connect Health App": "Connect Health App",
      "Connected": "Connected"
    }
  },
  am: {
    translation: {
      "Appearance": "ዕይታ",
      "Language": "ቋንቋ",
      "Light": "ቀላል",
      "Dark": "ጨለማ",
      "Local Alerts": "አካባቢያዊ ማንቂያዎች",
      "Joined Circles": "የተቀላቀሉ ክበቦች",
      "My Bookings": "የእኔ ምዝገባዎች",
      "Health & Activity": "ጤና እና እንቅስቃሴ",
      "Recent Activity": "የቅርብ ጊዜ እንቅስቃሴ",
      "Connect Health App": "የጤና መተግበሪያን ያገናኙ",
      "Connected": "ተገናኝቷል"
    }
  },
  fr: {
    translation: {
      "Appearance": "Apparence",
      "Language": "Langue",
      "Light": "Clair",
      "Dark": "Sombre",
      "Local Alerts": "Alertes Locales",
      "Joined Circles": "Cercles Rejoints",
      "My Bookings": "Mes Réservations",
      "Health & Activity": "Santé et Activité",
      "Recent Activity": "Activité Récente",
      "Connect Health App": "Connecter l'Appli Santé",
      "Connected": "Connecté"
    }
  },
  it: {
    translation: {
      "Appearance": "Aspetto",
      "Language": "Lingua",
      "Light": "Chiaro",
      "Dark": "Scuro",
      "Local Alerts": "Avvisi Locali",
      "Joined Circles": "Circoli Uniti",
      "My Bookings": "Le Mie Prenotazioni",
      "Health & Activity": "Salute e Attività",
      "Recent Activity": "Attività Recente",
      "Connect Health App": "Collega App Salute",
      "Connected": "Connesso"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
