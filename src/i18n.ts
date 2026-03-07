import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    lng: 'ar',
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
          install_title: 'Add to Home Screen',
          install_desc: 'Install the app for instant play and a better full-screen experience.',
          install_btn: 'Install',
          not_now: 'Not Now',
          installing: 'Installing...',
          install_success: 'Installed Successfully!',
          install_success_desc: 'You can close the website and open the app from your home screen for the best experience.',
          ios_install_title: 'Install on iOS',
          ios_install_desc: 'Tap the share button below and select "Add to Home Screen" to install.',
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
          install_title: 'إضافة إلى الشاشة الرئيسية',
          install_desc: 'قم بتثبيت التطبيق للعب الفوري وتجربة أفضل على الشاشة الكاملة.',
          install_btn: 'تثبيت',
          not_now: 'ليس الآن',
          installing: 'جاري التثبيت...',
          install_success: 'تم التثبيت بنجاح!',
          install_success_desc: 'يمكنك إغلاق الموقع وفتح التطبيق من الشاشة الرئيسية لتجربة أفضل.',
          ios_install_title: 'التثبيت على iOS',
          ios_install_desc: 'اضغط على زر المشاركة أدناه واختر "إضافة إلى الشاشة الرئيسية" للتثبيت.',
        }
      }
    }
  });

export default i18n;
