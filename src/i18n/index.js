import i18n from 'i18n-js';

import en from './en.json';
import nl from './nl.json';
import de from './de.json';

i18n.locale = 'en';
i18n.fallbacks = true;
i18n.translations = { en, de, nl };

export default i18n;
