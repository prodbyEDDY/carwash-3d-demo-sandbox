import { getRequestConfig } from 'next-intl/server';

import ru from './messages/ru.json';

// Единственная локаль v1 — русский; словарь статически в бандле.
export default getRequestConfig(async () => ({
  locale: 'ru',
  messages: ru,
}));
