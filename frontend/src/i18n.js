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
      "Connected": "Connected",
      "Home": "Home",
      "Explore": "Explore",
      "Community": "Community",
      "Profile": "Profile",
      "Your wellness journey awaits": "Your wellness journey awaits",
      "Happening Soon": "Happening Soon",
      "Featured Providers": "Featured Providers",
      "See all": "See all",
      "Join a Circle": "Join a Circle",
      "Browse": "Browse",
      "Book Now": "Book Now",
      "Your tribe, your wellness.": "Your tribe, your wellness.",
      "Right where you chat.": "Right where you chat.",
      "Retry": "Retry",
      "YOUR WELLNESS TRIBE": "YOUR WELLNESS TRIBE"
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
      "Connected": "ተገናኝቷል",
      "Home": "መነሻ",
      "Explore": "ያስሱ",
      "Community": "ማህበረሰብ",
      "Profile": "መገለጫ",
      "Your wellness journey awaits": "የጤንነት ጉዞዎ ይጠብቃል",
      "Happening Soon": "በቅርቡ የሚካሄድ",
      "Featured Providers": "ተለይተው የቀረቡ አቅራቢዎች",
      "See all": "ሁሉንም ይመልከቱ",
      "Join a Circle": "ክበብ ይቀላቀሉ",
      "Browse": "ያስሱ",
      "Book Now": "አሁን ይመዝገቡ",
      "Your tribe, your wellness.": "የእርስዎ ነገድ፣ የእርስዎ ጤንነት።",
      "Right where you chat.": "ልክ እርስዎ በሚወያዩበት ቦታ።",
      "Retry": "እንደገና ሞክር",
      "YOUR WELLNESS TRIBE": "የእርስዎ የጤንነት ነገድ"
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
      "Connected": "Connecté",
      "Home": "Accueil",
      "Explore": "Explorer",
      "Community": "Communauté",
      "Profile": "Profil",
      "Your wellness journey awaits": "Votre voyage de bien-être vous attend",
      "Happening Soon": "Bientôt disponible",
      "Featured Providers": "Fournisseurs en vedette",
      "See all": "Voir tout",
      "Join a Circle": "Rejoindre un Cercle",
      "Browse": "Parcourir",
      "Book Now": "Réserver",
      "Your tribe, your wellness.": "Votre tribu, votre bien-être.",
      "Right where you chat.": "Là où vous discutez.",
      "Retry": "Réessayer",
      "YOUR WELLNESS TRIBE": "VOTRE TRIBU DE BIEN-ÊTRE"
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
      "Connected": "Connesso",
      "Home": "Home",
      "Explore": "Esplora",
      "Community": "Comunità",
      "Profile": "Profilo",
      "Your wellness journey awaits": "Il tuo viaggio nel benessere ti aspetta",
      "Happening Soon": "Prossimamente",
      "Featured Providers": "Fornitori in evidenza",
      "See all": "Vedi tutto",
      "Join a Circle": "Unisciti a un Circolo",
      "Browse": "Sfoglia",
      "Book Now": "Prenota ora",
      "Your tribe, your wellness.": "La tua tribù, il tuo benessere.",
      "Right where you chat.": "Proprio dove chatti.",
      "Retry": "Riprova",
      "YOUR WELLNESS TRIBE": "LA TUA TRIBÙ DEL BENESSERE"
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
