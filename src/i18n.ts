import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ar',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: {
          welcome: 'Welcome to Quiz Game',
          start_game: 'Start Game',
          score: 'Score',
          timer: 'Time Left',
          category: 'Category',
          players: 'Players',
          teams: 'Teams',
          wait_turn: 'Wait for your turn',
          pick_category: 'Pick a category and value',
          correct: 'Correct!',
          incorrect: 'Incorrect!',
          time_up: 'Time is up!',
        }
      },
      ar: {
        translation: {
          welcome: 'مرحباً بك في مسابقة المعلومات',
          start_game: 'ابدأ اللعبة',
          score: 'الرصيد',
          timer: 'الوقت المتبقي',
          category: 'الفئة',
          players: 'اللاعبون',
          teams: 'الفرق',
          wait_turn: 'انتظر دورك',
          pick_category: 'اختر فئة وقيمة مكافأة',
          correct: 'إجابة صحيحة!',
          incorrect: 'إجابة خاطئة!',
          time_up: 'انتهى الوقت!',
        }
      }
    }
  });

export default i18n;
