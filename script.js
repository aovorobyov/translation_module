(function () {

// ============================================================
//  НАСТРОЙКИ API
// ============================================================

// MyMemory — бесплатно, без регистрации, 5000 слов/день
// С email лимит вырастает до 10 000 слов/день (необязательно)
const MYMEMORY_EMAIL = ''; // можно оставить пустым

// LibreTranslate — fallback если MyMemory не ответил
// Публичные инстансы (можно менять если лежит):
//   https://libretranslate.com          — официальный, нужен ключ для >5 req
//   https://translate.terraprint.co     — публичный без ключа
//   https://lt.vern.cc                  — публичный без ключа
const LIBRE_URL = 'https://translate.terraprint.co/translate';

const STORAGE_KEY_LANG  = 'site_lang';
const STORAGE_KEY_CACHE = 'site_tr_cache';
const DEFAULT_LANG      = 'ru';

const ATTR_ORIGINAL              = 'data-orig-text';
const ATTR_ORIGINAL_EN           = 'data-orig-en-text';
const ATTR_ORIGINAL_ATTR_PREFIX    = 'data-orig-attr-';
const ATTR_ORIGINAL_EN_ATTR_PREFIX = 'data-orig-en-attr-';

// Tilda почти всегда держит видимый контент внутри .t-rec / popup-контейнеров.
// Важно: scope проверяем только один раз для текущего узла,
// а не для всей цепочки предков, иначе поиск ломается на body/html.
const TRANSLATE_SCOPE_SELECTORS = [
  '#allrecords .t-rec',
  '#allrecords .t-popup',
  '#allrecords .t-store__prod-popup',
];

// Контентные обёртки, в которых Tilda обычно рендерит видимый текст.
const CONTENT_SELECTOR = [
  '.tn-atom',
  '.t-title',
  '.t-descr',
  '.t-text',
  '.t-name',
  '.t-uptitle',
  '.t-btn',
  '.t-submit',
  '.t-feed__post-content',
  '.t-feed__post-textwrapper',
  '.t-card__title',
  '.t-card__descr',
  '.t-store__card',
  '.t-store__prod-popup',
  '.t-popup__container',
  '.t-form__inputsbox',
  '.t-input-block',
  'label',
].join(', ');

// Служебные ветки, которые попадают в DOM блока, но не являются контентом страницы.
// [aria-hidden="true"] намеренно убран: Tilda ставит его на контейнеры слайдов
// и accordion-блоков, из-за чего el.closest() блокирует весь вложенный контент.
// Реальную видимость контролирует isVisible() через getComputedStyle.
const EXCLUDED_SELECTOR = [
  '.t396__carrier',
  '.t396__filter',
  '.js-feed-preloader',
  '.t-feed__post-preloader',
  '.t-popup__close',
  '.t-popup__close-wrapper',
  '.t-slds__bullet_wrapper',
  '.t-slds__bullet',
  '.t-zoomable__btn',
  '.b24-form',
  '.b24-widget-button',
].join(', ');

// Ограничения для API: только полезные видимые RU-строки.
const TRANSLATE_ONLY_VISIBLE    = true;
const API_MIN_TEXT_LENGTH       = 2;
const API_REQUIRE_CYRILLIC      = true;
const API_MAX_UNIQUE_PER_PASS   = 120;
const TRANSLATABLE_ATTRIBUTES   = ['placeholder', 'value'];

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
]);
// ============================================================
//  СЛОВАРЬ ПЕРЕВОДОВ
//
//  КАК ЗАПОЛНЯТЬ:
//  - Регистр ключа неважен — 'купить', 'Купить', 'КУПИТЬ' одно и то же
//  - Регистр перевода применяется пропорционально оригиналу:
//      'купить' → 'buy'  /  'Купить' → 'Buy'  /  'КУПИТЬ' → 'BUY'
//  - Длинные фразы пиши ВЫШЕ коротких (матчинг идёт по убыванию длины)
//  - Всё что не нашлось в словаре → MyMemory API → LibreTranslate (fallback)
// ============================================================

// ── Длинные фразы (переводить целиком, должны стоять перед короткими совпадениями) ─

const DICTIONARY = {
  'помогать талантливым моделям, предоставляя доступ к лучшим проектам в индустрии и подстраиваясь под динамические условия мира моды. Мы стремимся к созданию отношений, основанных на доверии и взаимовыгодном сотрудничестве. Наш вклад в развитие фэшн-индустрии –обширный пул моделей, профессионализм, усердная работа и человечность.':
    'to help talented models by providing access to the best projects in the industry and adapting to the dynamic conditions of the fashion world. We strive to build relationships based on trust and mutually beneficial cooperation. Our contribution to the development of the fashion industry is a large pool of models, professionalism, hard work and humanity.',
  'Нажимая кнопку «Send», я даю свое согласие на обработку моих персональных данных, в соответствии с Федеральным законом от 27.07.2006 года №152-ФЗ «О персональных данных», на условиях и для целей, определенных в Согласии на обработку персональных данных':
    'By clicking the "Send" button, I consent to the processing of my personal data in accordance with Federal Law No. 152-FZ of July 27, 2006 "On Personal Data", under the terms and for the purposes specified in the Consent to Personal Data Processing.',
  '18 октября в креативном пространстве АКИ.лаб на Большой Никитской улице состоялось первое мероприятие агентства «Open Up Models» для представителей модной индустрии: Open Up Open Talk: диалог для экспертов мира моды.':
    'On October 18, the first event of the Open Up Models agency for fashion industry professionals took place in the creative space AKI.lab on Bolshaya Nikitskaya Street: Open Up Open Talk: a dialogue for fashion world experts.',
  'Мы предоставляем моделям возможность сотрудничества с крупными мировыми брендами и лучшими креативными проектами, создавая все необходимые условия для карьерного роста.':
    'We provide models with the opportunity to collaborate with major global brands and the best creative projects, creating all the necessary conditions for career growth.',
  'Бутиковый продакшн, где исключительное качество и уникальность стоят превыше всего. Мы объединили в себе вершину профессионалов российской FASHION-индустрии':
    'Boutique production, where exceptional quality and uniqueness are paramount. We have united the top professionals of the Russian FASHION-industry',
  'материнское и принимающее модельное агентство, работающее как на российском, так и на зарубежном рынке.':
    'a mother and host model agency operating in both the Russian and international markets.',
  'Компания Битрикс24 не несёт ответственности за содержимое формы, но вы можете сообщить нам о нарушении':
    'Bitrix24 is not responsible for the content of the form, but you can report a violation to us.',
  'находить и развивать уникальные лица, которые помогут брендам и клиентам выгодно выделиться на рынке.':
    'to find and develop unique faces that will help brands and clients stand out profitably in the market.',
  'Мы сотрудничаем исключительно с востребованными специалистами, каждый из которых имеет':
    'We cooperate exclusively with in-demand specialists, each of whom has',
  'Наша команда состоит из профессионалов с многолетним опытом работы в индустрии моды.':
    'Our team consists of professionals with many years of experience in the fashion industry.',
  'Введите Ваш ник в telegram, который связан с вашим номером телефона.':
    'Enter your Telegram username linked to your phone number.',
  'заполните данные формы, наш менеджер свяжется с вами в течение суток':
    'fill out the form data, our manager will contact you within 24 hours',
  'Создание уникальных визуальных образов с профессиональной командой':
    'Creating unique visual images with a professional team',
  'Производство видео и динамичного контента для рекламных кампаний':
    'Production of video and dynamic content for advertising campaigns',
  'Заполните бриф на съемку и мы свяжемся с вами в ближайшее время':
    'Fill out the brief for the shoot and we will contact you as soon as possible',
  'Кастинги с топ-моделями и новыми лицами, в России и за рубежом':
    'Castings with top models and new faces, in Russia and abroad',
  'Полная организация съемок на уникальных локациях по всему миру':
    'Full organization of filming on unique locations around the world',
  'фотографы, стилисты, визажисты, модели, продюсеры, ретушеры':
    'photographers, stylists, makeup artists, models, producers, retouchers',
  'В эпоху стремительного роста рынка мы обеспечиваем вам':
    'In an era of rapid market growth, we provide you with',
  'Open Up Open Talk: диалог для экспертов мира моды':
    'Open Up Open Talk: dialogue for fashion world experts',
  'гарантируя соблюдение сроков и высокое качество':
    'guaranteeing compliance with deadlines and high quality',
  'по созданию лукбуков, кампейнов и каталогов,':
    'to create lookbooks, campaigns and catalogs,',
  'задачу и создаем индивидуальное предложение':
    'task and create an individual offer',
  'г. Москва, 2-я Бауманская, 9/23, офис 1201':
    'Moscow, 2nd Baumanskaya St., 9/23, office 1201',
  'более 5 лет опыта в сфере fashion-съёмок':
    'more than 5 years of experience in fashion filming',
  'международное бронирование и размещение':
    'international booking and accommodation',
  'политикой обработки персональных данных':
    '"personal data processing policy"',
  'Ваш ник в telegram | Telegram username':
    'Ваш ник в Telegram | Telegram username',
  'Политика обработки персональных данных': 'Personal Data Processing Policy',
  'Ссылка на instagram | Instagram link':
    'Ссылка на Instagram | Instagram link',
  'От концепции до финальной обработки,': 'From concept to final processing,',
  'ПОдбор моделей на территории россии': 'Selection of models in Russia',
  'Поле обязательно для заполнения': 'Field is required',
  'как в России, так и за рубежом': 'both in Russia and abroad',
  'События и мероприятия OPENUP': 'OPENUP Events and Activities',
  'Видео и контент для соцсетей': 'Social Media Videos & Content',
  'Съемки лукбуков и кампейнов': 'Lookbook & Campaign Shootings',
  'локации, моделей и команду': 'locations, models and team',
  'Полный цикл продакшн-услуг': 'Full cycle of production services',
  'Прямые контакты для связи:': 'Direct contacts:',
  'самые амбициозные проекты': 'the most ambitious projects',
  'конкурентное преимущество': 'competitive advantage',
  'Контактные данные модели': 'Model Contact Details',
  'Телефон | Phone number': 'Телефон | Phone number',
  'Мы готовы реализовать': 'We are ready to implement',
  'международные девушки': 'international women',
  'Сообщить о нарушении': 'Report a violation',
  'Забукировать модель': 'Booking model',
  'международные парни': 'international men',
  'Скачать презентацию': 'Download the presentation',
  'бронировать модель': 'booking model',
  'Съемки за границей': 'Shooting abroad',
  'Форма не актуальна': 'Form is not relevant',
  'детское модельное агентство': 'children model agency',
  'Фамилия | Surname': 'Фамилия | Surname',
  'Отправить еще раз': 'Send again',
  'съемочный процесс': 'filming process',
  'В нашей команде —': 'In our team',
  'для связи с нами': 'to contact Us',
  'Избранные модели': 'Featured models',
  'Заполнить анкету': 'Fill out the form',
  'Связаться с нами': 'Contact us',
  'пост-продакшн и': 'post productuon and',
  'Социальные сети': 'Social Networking',
  'Кастинг моделей': 'Model casting',
  'готовый контент': 'Prepend content',
  'Как мы работаем': 'How we work',
  'Итоговая сумма:': 'Total amount:',
  'Номер телефона': 'Phone number',
  'Катерина Кобан': 'Caterina Coban',
  'Форма кастинга': 'Casting form',
  'Бриф на съемку': 'Shooting brief',
  'Оформить заказ': 'Place an order',
  'OPENUP магазин': 'OPENUP shop',
  'Возраст | Age': 'Возраст | Age',
  'Загрузить еще': 'Load more',
  'стать моделью': 'become a model',
  'предоставляем': 'We provide',
  'Город | City': 'Город | City',
  'Очистить все': 'Clear All',
  'Размер обуви': 'Shoes',
  'Я согласен с': 'I consent to the',
  'бронь модели': 'booking model',

  // ── Имена (полные) ──────────────────────────────────────────
  'Ксения Дорофеева': 'Ksenia Dorofeeva',
  'Катя привалова': 'Kate Privalova',
  'Олеся Чумаченко': 'Olesya Chumachenko',
  'Яна Доломанова': 'Yana Dolomanova',
  'Дарина Чистякова': 'Darina Chistiakova',
  'София Шлыкова': 'Sofia Shlykova',
  'Лиза Барбашова': 'Liza Barbashova',
  'Маруся Калязина': 'Marusya Kalyazina',
  'Ангелина Пирц': 'Angelina Pirts',
  'Борис Махмуров': 'Boris Mahmurov',
  'Диана Беляева': 'Diana Belyaeva',
  'Дмитрий Трякин': 'Dmitriy Tryakin',
  'Анастасия Сапрыкина': 'Anastasia Saprikina',
  'Сергей Харьков': 'Sergey Kharkov',
  'София Лобова': 'Sophie Lobova',
  'Саша Блинов': 'Sasha Blinov',
  'Лиза Стасенко': 'Liza Stasenko',
  'Настя Жидких': 'Nastya Zhidkikh',
  'Даша Соломонова': 'Dasha Solomonova',
  'Амелия Сонн': 'Amelia Sonn',
  'Катя Исаева': 'Katya Isaeva',
  'Алена Александрова': 'Alena Alexandrova',
  'Катрин Захарова': 'Katrin Zakharova',
  'Ангелина Дромашко': 'Angelina Dromashko',
  'Ася Горячева': 'Asya Goryacheva',
  'Соня Горшенева': 'Sonya Gorsheneva',
  'Ульяна Рулева': 'Ulyana Ruleva',
  'Анна Бояр': 'Anna Boyar',
  'Элиза Бежан': 'Eliza Bejan',
  'Юлия Хомич': 'Yulya Khomich',
  'Гела Чиняева': 'Gela Chinyaeva',
  'Мария Земляникина': 'Maria Zemlyanikina',
  'Гертруда Сагдеева': 'Gertruda Sagdeeva',
  'София Локтионова': 'Sofiya Loktionova',
  'Диана Гали': 'Diana Gali',
  'Влада Лачимова': 'Vlada Lachimova',
  'Павел Нирша': 'Pavel Nirsha',
  'Артур Харченко': 'Artur Kharchenko',
  'Лила Панк': 'Lila Pank',
  'Коля Волков': 'Kolya Volkov',
  'Наташа Ешченко': 'Natasha Eshchenko',
  'Паулина Устюгова': 'Paulina Ustyugova',
  'Полина Шотова': 'Polina Shotova',
  'Саида Валиева': 'Saida Valieva',
  'Мария Руденко': 'Maria Rudenko',
  'Катя Немцева': 'Kate Nemtseva',
  'Анастасия Вертюхова': 'Anastasia Vertyukhova',
  'Алена Рудик': 'Alena Rudik',
  'Кристина Букарева': 'Kristina Bukareva',
  'Арина Гладкова': 'Arina Gladkova',
  'Влад Пряхин': 'Vlad Pryahin',
  'Дочь Олега': 'Doch Olega',
  'Алина Захарова': 'Alina Zakharova',
  'Яна Спиркова': 'Yana Spirkova',
  'Ольга Безрукова': 'Olga Bezrukova',
  'Арина Гаврюшенко': 'Arina Gavryushenko',
  'Ивана Циунчик': 'Ivana Tsiunchick',
  'Дарья Кот': 'Daria Kot',
  'Даша Першина': 'Dasha Pershina',
  'Лиззи Вихарева': 'Lissy Vikhareva',
  'Миша Шматов': 'Misha Shmatov',
  'Карина Логинова': 'Karina Loginova',
  'Сан Пална': 'Sun Palna',
  'Лиза Мукoмель': 'Liza Mukomel',
  'Сергей Самородский': 'Sergey Samorodsky',
  'Варя Берштейн': 'Varya Bershtein',
  'Дима Тамахин': 'Dima Tamahin',
  'Ярослав Евтихов': 'Yaroslav Evtikhov',
  'Богдан Демкив': 'Bogdan Demkiv',
  'Мила Вулых': 'Mila Vulykh',
  'Тина Мосикян': 'Tina Mosikyan',
  'Анна Орлова': 'Anna Orlova',
  'Крис Каткова': 'Kris Katkova',
  'Кирилл Быковский': 'Kirill Bykovskiy',
  'Катя Гусева': 'Katya Guseva',
  'Али Оск': 'Ali Osk',
  'Дари Медведева': 'Dari Medvedeva',
  'Андрей Боровик': 'Andrey Borovik',
  'Нина Гизбрехт': 'Nina Gizbrekht',
  'Алена Моисеева': 'Alena Moiseeva',
  'Наталья Кузнецова': 'Natalia Kuznetsova',
  'Валентина Мальцева': 'Valentina Maltseva',
  'Риа Рева': 'Ria Reva',
  'Роман Солнцев': 'Roman Solntsev',
  'Катя Коновалова': 'Katya Konovalova',
  'Иван Доля': 'Ivan Dolya',
  'Кристал Хомякова': 'Kristal Khomyakova',
  'Татьяна Федорова': 'Tatyana Fedorova',
  'Катерина Кобан': 'Katerina Koban',
  'Алиса Шапоренко': 'Alisa Shaporenko',
  'Виктория Егорова': 'Victoria Egorova',
  'Данил Григорьев': 'Danil Grigoryev',
  'Мария Кудри': 'Maria Kudry',
  'Яна Шульженко': 'Yana Shulzhenko',
  'Елизавета Ленская': 'Elizaveta Lenskaya',
  'Кристина Гонтар': 'Kristina Gontar',
  'Жанна Данилова': 'Janna Danilova',
  'Настя Нехаева': 'Nastya Nekhaeva',
  'Лиза Панова': 'Liza Panova',
  'Сямра Караева': 'Syamra Karaeva',
  'Слава Савельев': 'Slava Savelyev',
  'Александр Крамаренко': 'Alexander Kramarenko',
  'Вероника Сафроненко': 'Veronika Safronenko',
  'Даша Политова': 'Dasha Politova',
  'Анна Половинкина': 'Anna Polovinkina',
  'Игорь Чернявый': 'Igor Chernyaviy',
  'Сергей Кутуков': 'Sergey Kutukov',
  'Мария Лотта': 'Maria Lotta',
  'Анна Рос': 'Anna Ros',
  'Эрик Ваганьян': 'Erik Vaganyan',
  'Катя Пан': 'Katya Pan',
  'Кристина Делукина': 'Kristina Delukina',
  'Вика Наранович': 'Vika Naranovich',
  'Алина Хаст': 'Alina Hust',
  'Алексей Никифоров': 'Alexey Nikiforov',
  'Ноа Константинова': 'Noa Konstantinova',
  'Анисия Челохсаева': 'Anisiya Chelokhsaeva',
  'Арина Крюкова': 'Arina Krukova',
  'Екатерина Р': 'Ekaterina R',
  'Таня Жукова': 'Tanya Zhukova',
  'Лера Третьякова': 'Lera Tretyakova',
  'Полина Набатова': 'Polina Nabatova',
  'Макс Чернов': 'Maks Chernov',
  'Александра Москалева': 'Aleksandra Moskaleva',
  'Эля Синицына': 'Elya Sinitsina',
  'Ангелина Радзкова': 'Angelina Radzkova',
  'Пилар Тарше': 'Pilar Tarche',
  'Полина Оганичева': 'Polina Oganicheva',
  'Наталья Нагорная': 'Natalya Nagornaya',
  'Анна Маас': 'Anna Maas',
  'Мария Иванова': 'Maria Ivanova',
  'Виктория Гречихина': 'Victoria Grechihina',
  'Александра Чуп': 'Aleksandra Chup',
  'Дарья Третьякова': 'Daria Tretyakova',
  'Зиза Дидух': 'Ziza Didukh',
  'Амина Лемешкина': 'Amina Lemeshkina',
  'Мария Кирюхина': 'Maria Kiryukhina',
  'Брэдли Верагтен': 'Bradley Veragten',
  'Дарья Московая': 'Daria Moskovaya',
  'Никита Осминин': 'Nikita Osminin',
  'Полина Мутовина': 'Polina Mutovina',
  'Толи Волков': 'Toli Volkov',
  'Михаил Кожевников': 'Mikhail Kozhevnikov',
  'Дарья Корой': 'Daria Koroy',
  'Алекс Наумова': 'Alex Naumova',
  'Тома Джебуадзе': 'Toma Dgebuadze',
  'Василий Пинчук': 'Vasiliy Pinchuk',
  'Елена Герман': 'Elena German',
  'Света Паневина': 'Sveta Panevina',
  'Екатерина Лапочкина': 'Ekaterina Lapochkina',
  'Алексей Шамаев': 'Alexey Shamaev',
  'Ярослав Романов': 'Yaroslav Romanov',
  'Александр Сурнаков': 'Aleksandr Surnakov',
  'Анна Олис': 'Anna Olis',
  'Анна Симухина': 'Anna Simuhina',
  'Элизабет Доура': 'Elisabeth Doura',
  'Майя Гитер': 'Maya Giter',
  'Иван Росьянов': 'Ivan Rosyanov',
  'Стив Шевченко': 'Steve Shevchenko',
  'Диана Кустарникова': 'Diana Kustarnikova',
  'Андрей Лобанов': 'Andrey Lobanov',
  'Лиля Смутина': 'Lilya Smutina',
  'Мирослав Такиев': 'Miroslav Takiev',
  'Федор Литовченко': 'Fedor Litovchenko',
  'Егор Пиксайкин': 'Egor Piksaykin',
  'Денис Долгов': 'Denis Dolgov',
  'Эрнест Климко': 'Ernest Klimko',
  'Влад Прудников': 'Vlad Prudnikov',
  'Злата Елисеева': 'Zlata Eliseeva',
  'Анна Яцкова': 'Anna Yatskova',
  'Миша Натали': 'Misha Natali',
  'Дамир Мустафин': 'Damir Mustafin',
  'Марк Петровский': 'Mark Petrovskii',
  'Саша Горбунов': 'Sasha Gorbunov',
  'Катя Казакова': 'Katya Kazakova',
  'Злата Краснова': 'Zlata Krasnova',
  'Анастасия Патерюхина': 'Anastasia Pateryuhina',
  'Лиза Сиваева': 'Liza Sivaeva',
  'Сеня Даукшис': 'Senya Daukshis',
  'Тина Лозовская': 'Tina Lozovskaya',
  'Надя Назарова': 'Nadya Nazarova',
  'Григорий Мещанин': 'Grigoriy Meschanin',
  'Катя Гончарова': 'Katya Goncharova',
  'Алекса Дымнич': 'Alexa Dymnich',
  'Ксения Негодуйко': 'Ksenia Negoduyko',
  'Лида Леонченко': 'Lida Leonchenko',
  'Виталий Безубяк': 'Vitaly Bezubiak',
  'Анастасия Левинская': 'Anastasiya Levinskaya',
  'Лиза Чубарова': 'Liza Chubarova',
  'Тая Мороз': 'Taya Moroz',
  'Арина Хохлова': 'Arina Khokhlova',
  'Дарья Никонова': 'Daria Nikonova',
  'Ангелина Петрова': 'Angelina Petrova',
  'Алена Шумилова': 'Alena Shumilova',
  'Татьяна Козина': 'Tatiana Kozina',
  'Настя Кублицкая': 'Nastya Kublitskaya',
  'Катя Цыбулина': 'Katya Tsybulina',
  'Анита Рублевская': 'Anita Rublevskaya',
  'Александр Гордеев': 'Alexander Gordeev',
  'Савелий Соловьев': 'Saveliy Solovyev',
  'Сарюна Цыдыпова': 'Saryuna Tsydypova',
  'Алла Мельникова': 'Alla Melnikova',
  'Саша Мюллер': 'Sasha Muller',
  'Марго Шангина': 'Margo Shangina',
  'Юнна Кочнева': 'Yunna Kochneva',
  'Тимур Змиевский': 'Timur Zmievskiy',
  'Анна Добрынина': 'Anna Dobrynina',
  'Настя Мали': 'Nastya Mali',
  'Анна Еврюкова': 'Anna Evryukova',
  'Никита Вариончик': 'Nikita Varionchik',
  'Максим Крохин': 'Maksim Krokhin',
  'Анна Торопова': 'Anna Toropova',
  'Яна Андреева': 'Yana Andreeva',
  'Мария Матвеева': 'Maria Matveeva',
  'Аюна Цыдемпилова': 'Ayuna Tsydempilova',
  'Мари Сергеева': 'Mary Sergeeva',
  'Саша Лукошкова': 'Sasha Lukoshkova',
  'Алла Свиридченкова': 'Alla Sviridchenkova',
  'Медина Нурланова': 'Medina Nurlanova',
  'Анастасия Пензова': 'Anastasia Penzova',
  'Екатерина Волкова': 'Ekaterina Volkova',
  'Виктория Боева': 'Vika Boeva',
  'Ульяна Фролова': 'Ulyana Frolova',
  'Николай Волков': 'Nikolai Volkov',
  'Марина Ковшова': 'Marina Kovshova',
  'Кристина Каровашкова': 'Kristina Karovashkova',
  'Валя Белоусова': 'Valya Belousova',
  'Аркадий Плешаков': 'Arkady Pleshakov',
  'Дарья Барышникова': 'Daria Baryshnikova',
  'Светлана Иванова': 'Svetlana Ivanova',
  'Женя Катавa': 'Zhenya Katava',
  'Ксения Ильчук': 'Ksenia Ilchuk',
  'Александр Тимченко': 'Alexander Timchenko',
  'Соня Типанова': 'Sonya Tipanova',
  'Дон Балдин': 'Don Baldin',
  'Катя Семенова': 'Kate Semenova',
  'Саша Баранов': 'Sasha Baranov',
  'Егор Квасов': 'Egor Kvasov',
  'Кейт Роуз': 'Kate Rose',
  'Арья Хандро': 'Arya Khandro',
  'Селин Мариллат': 'Celine Marillat',
  'Мария Барыкина': 'Maria Barykina',
  'Ксения Фурс': 'Ksenia Furs',
  'Егор Иванов': 'Egor Ivanov',
  'Валерия Беляева': 'Valeria Belyaeva',
  'Али Ахметов': 'Ali Akhmetov',
  'Кейт Ольхина': 'Kate Olkhina',
  'Ольга Затула': 'Olga Zatula',
  'Юлия Бычкова': 'Yulia Bychkova',
  'Катрин Кананура': 'Katrin Kananura',
  'Глаша Пронина': 'Glasha Pronina',
  'Андрей Белов': 'Andrey Belov',
  'Валерия Хардт': 'Valeria Hardt',
  'Мария Галяцкая': 'Maria Galyatskaya',
  'Константин Потапов': 'Konstantin Potapov',
  'Артур Варковастов': 'Artur Varkovastov',
  'Игорь Тараканов': 'Igor Tarakanov',
  'Мария Сущева': 'Maria Suscheva',
  'Софи мкртчан': 'Sofi Mkrtchan',
  'Гоша Сидоров': 'Gosha Sidorov',
  'Валерия Головня': 'Valeria Golovnya',
  'Мария Патанина': 'Maria Patanina',
  'Кира Гунина': 'Kira Gunina',
  'Марина Касьянова': 'Marina Kasyanova',
  'Саша Булыгa': 'Sasha Bulyga',
  'Яна Кулакова': 'Yana Kulakova',
  'Джавид Тагиев': 'Javid Tagiev',
  'Яна Барсегян': 'Yana Barseghyan',
  'Юлия Лукша': 'Julia Luksha',
  'Лиза Гордеенко': 'Liza Gordeenko',
  'Кристина Кудзинович': 'Kristina Kudzinovich',
  'Камилла Магаева': 'Kamilla Magaeva',
  'Эмилия Шрамко': 'Emilia Shramko',
  'Соня Золоевa': 'Sonya Zoloeva',
  'Анастасия Баранова': 'Anastasia Baranova',
  'Александра Синцова': 'Alexandra Sintsova',
  'Карина Каширская': 'Karina Kashirskaya',
  'Татьяна Корне': 'Tatyana Korne',
  'Гордей Михаленко': 'Gordey Mikhalenko',
  'Даша Гаевская': 'Dasha Gaevskaya',
  'Салам Шихшабеков': 'Salam Shikhshabekov',
  'Виталина Бертон': 'Vitalina Burton',
  'Валерий Пахомов': 'Valeriy Pakhomov',
  'Чай Ке': 'Chai Ke',
  'Дарья Дьячкова': 'Daria Dyachkova',
  'Майя Макшанцева': 'Maya Makshantseva',
  'Анастасия Колганова': 'Anastasia Kolganova',
  'Камилла Исентлюк': 'Kamilla Isentliuk',
  'Марина Полкопина': 'Marina Polkopina',
  'Полина Гороховская': 'Polina Gorokhovskaya',
  'София Прищенко': 'Sofia Prischenko',
  'Арина Сокар': 'Arina Sokar',
  'Александр Русич': 'Alexander Rusich',
  'Степан Слысенко': 'Stepan Slysenko',
  'Мария Столяр': 'Maria Stolyar',
  'Ксения Котина': 'Ksenia Kotina',
  'Захар Петров': 'Zahar Petrov',
  'Вадим Гришаев': 'Vadim Grishaev',
  'Таня Мэдиссон': 'Tanya Madisson',
  'Александра Третьякова': 'Alexandra Tretyakova',
  'Алиса Гусева': 'Alisa Guseva',
  'Роман Семейко': 'Roman Semeyko',
  'Стефания Куприянова': 'Stefania Kupriyanova',
  'Егор Сушилин': 'Egor Sushilin',
  'Армен Амирaгян': 'Armen Amiraghyan',
  'Александр Калишев': 'Alexander Kalishev',
  'Ханна Камелина': 'Hanna Kamelina',
  'Ксения Пунтус': 'Kseniia Puntus',
  'Владлена Воликовская': 'Vladlena Volikovskaya',
  'Егор Поляков': 'Egor Polyakov',
  'Глеб Тюрин': 'Gleb Tyurin',
  'Рамин Руднев': 'Ramin Rudnev',
  'Аля Спир': 'Alya Spir',
  'Никита Кузнецов': 'Nikita Kuznetsov',
  'Вероника Истомина': 'Veronika Istomina',
  'Альбина Мостовая': 'Albina Mostovaya',
  'Злата Смалькова': 'Zlata Smalkova',
  'Лора Бабакохиан': 'Lora Babakokhian',
  'Майя Евстратова': 'Maya Evstratova',
  'Мила Наумова': 'Mila Naumova',
  'Валерия Планидина': 'Valeria Planidina',
  'Сергей Заборский': 'Sergey Zaborskiy',
  'Николай Вознюк': 'Nikolay Voznyuk',
  'Евгения Федосеева': 'Evgeniya Fedoseeva',
  'Елена Чукланова': 'Elena Chuklanova',
  'София Свиридова': 'Sofia Sviridova',
  'Лия Серге': 'Lia Serge',
  'Марина Тассо': 'Marina Tasso',
  'Тори Эванс': 'Tory Evans',
  'Ярослав Шведовский': 'Yaroslav Shvedovskii',
  'Меланика Мельникова': 'Melanika Melnikova',
  'Ксения Жизневская': 'Ksenia Zhiznevskaya',
  'Анастасия Карелина': 'Anastasia Karelina',
  'Елена Антонова': 'Elena Antonova',
  'Елена Бочкарева': 'Elena Bochkareva',
  'Вера Полоскова': 'Vera Poloskova',
  'Алина Шайхутдинова': 'Alina Shaikhutdinova',
  'Дженнифер Одиль': 'Jennifer Odile',
  'Марина Коротич': 'Marina Korotich',
  'Елен Гончарова': 'Elen Goncharova',
  'Ната Квинт': 'Nata Kvint',
  'Степан Чимов': 'Stepan Chimov',
  'Дарья Смирнова': 'Daria Smirnova',
  'Мирослав Рахимов': 'Miroslav Rakhimov',
  'Вадим Колосов': 'Vadim Kolosov',
  'Наталья Лесникова': 'Natalia Lesnikova',
  'Тая Шпак': 'Taya Shpak',
  'Ярослав Ткаленко': 'Yaroslav Tkalenko',
  'Эрика Булатая': 'Erika Bulataya',
  'Яна Картуха': 'Yana Kartukha',
  'Саша Линд': 'Sasha Lynd',
  'Ксения Галибина': 'Ksenia Galibina',
  'Маржана Шингарева': 'Marzhana Shingareva',
  'Анжелика Гогуева': 'Anzhelika Gogueva',
  'Лера Дербенева': 'Lera Derbeneva',
  'Анна Васильева': 'Anna Vasilieva',
  'Лия Газизова': 'Lia Gazizova',
  'Ангелина Кондрашова': 'Angelina Kondrashova',
  'Вика Петренко': 'Vika Petrenko',
  'Влад Кузнецов': 'Vlad Kuznetsov',
  'Лиза Разумова': 'Liza Razumova',
  'Варвара Гребенщикова': 'Varvara Grebenshchikova',
  'Ирина Солонец': 'Irina Solonets',
  'Дарина Ляпина': 'Darina Lyapina',
  'Леона Глазунова': 'Leona Glazunova',
  'Мария Соломкина': 'Marie Solomkina',
  'Лео Гомельский': 'Leo Gomelsky',
  'Ия Куценко': 'Iya Kutsenko',
  'Илья Пыслар': 'Ilya Pyslar',
  'арина гордовская': 'Arina Gordovskaya',
  'Шахсана Гафурова': 'Shahsana Gafurova',
  'Люси Логинова': 'Lucy Loginova',
  'Тамерлан Рафиков': 'Tamerlan Rafikov',
  'Илья Пысларь': 'Ilya Pyslar',
  'валентина Петина': 'Valentina Petina',
  'Алина ХУст': 'Alina Hust',
  'лила панкова': 'Lila Pankova',
  'Виталина БУртон': 'Vitalina Burton',
  'Далья Мруэ': 'Dalia Mrue',
  'гаухар Шотаева': 'Gaukhar Shotaeva',
  'арина сокарь': 'Arina Sokar',
  'саша булыга': 'Sasha Bulyga',

  // ── Имена (одиночные / короткие варианты) ───────────────────
  'Катерина': 'Katerina',
  'Далья': 'Dalia',
  'Ксения' : 'Ksenia',
  'Лисси': 'Lissy',
  'Алла': 'Alla',
  'Анна': 'Anna',
  'Анисия': 'Anisiya',
  'Анастасия': 'Anastasia',
  'Александра': 'Aleksandra',
  'Ася': 'Asya',
  'Римма': 'Rimma',
  'Женя': 'Zhenya',
  'Паулина': 'Paulina',
  'Маруся': 'Marusya',
  'Татьяна': 'Tatyana',
  'Соня': 'Sonya',
  'Ева': 'Eva',
  'Настя': 'Nastya',
  'Лиза': 'Liza',
  'Катрин': 'Katrin',
  'Селин': 'Celine',
  'Лия': 'Lia',
  'Арина': 'Arina',
  'Алиса': 'Alisa',
  'Елизавета': 'Elisabeth',
  'Ханна': 'Hanna',
  'Сямра': 'Syamra',
  'Катя': 'Katya',
  'Мария': 'Maria',
  'Амина': 'Amina',
  'Анжелика': 'Anzhelika',
  'Виктория': 'Victoria',
  'Дари': 'Dari',
  'Саша': 'Sasha',
  'Вера': 'Vera',
  'Дарья': 'Daria',
  'Кристина': 'Kristina',
  'Наталья': 'Natalia',
  'Майя': 'Maya',
  'Сун Пална': 'Sun Palna',
  'Злата': 'Zlata',
  'Арья': 'Arya',
  'Елена': 'Elena',
  'Марго': 'Margo',
  'Зиза': 'Ziza',
  'Лана': 'Lana',
  'Гаухар': 'Gaukhar',
  'Тая': 'Taya',
  'Веро': 'Vero',
  'Маша': 'Masha',
  'Екатерина': 'Ekaterina',
  'Даша': 'Dasha',
  'Тома': 'Toma',
  'Медина': 'Medina',
  'Батура': 'Batura',
  'Диана': 'Diana',
  'Эля': 'Elya',
  'Света': 'Sveta',
  'Кейт': 'Kate',
  'Юля': 'Yulya',
  'Сарюна': 'Saryuna',
  'Мэри': 'Mary',
  'Нина': 'Nina',
  'Ульяна': 'Ulyana',
  'Надежда': 'Nadezhda',
  'Светлана': 'Svetlana',
  'Ноа': 'Noa',
  'Саида': 'Saida',
  'Элиза': 'Eliza',
  'София': 'Sofia',
  'Маржана': 'Marzhana',
  'Санта': 'Santa',
  'Алена': 'Alena',
  'Анита': 'Anita',
  'Карина': 'Karina',
  'Юнна': 'Yunna',
  'Эрика': 'Erika',
  'Валя': 'Valya',
  'Ия': 'Iya',
  'Дарина': 'Darina',
  'Ангелина': 'Angelina',
  'Владлена': 'Vladlena',
  'Крис': 'Kris',
  'Леона': 'Leona',
  'Юлия': 'Yulia',
  'Гела': 'Gela',
  'Валерия': 'Valeria',
  'Ольга': 'Olga',
  'Меланика': 'Melanika',
  'Лера': 'Lera',
  'Эмилия': 'Emilia',
  'Камилла': 'Kamilla',
  'Урсула': 'Ursula',
  'Тори': 'Tory',
  'Амелия': 'Amelia',
  'Алекс': 'Alex',
  'Мари': 'Marie',
  'Марина': 'Marina',
  'Таня': 'Tanya',
  'Вика': 'Vika',
  'Лора': 'Lora',
  'Яна': 'Yana',
  'Олеся': 'Olesya',
  'Алина': 'Alina',
  'Мишель': 'Michelle',
  'Вероника': 'Veronika',
  'Тати': 'Tati',
  'Мила': 'Mila',
  'Ирина': 'Irina',
  'Жанна': 'Janna',
  'Аюна': 'Ayuna',
  'Элен': 'Elen',
  'Стефания': 'Stefania',
  'Кристал': 'Kristal',
  'Альбина': 'Albina',
  'Ивана': 'Ivana',
  'Кира': 'Kira',
  'Таисия': 'Taisiya',
  'Шахсана': 'Shahsana',
  'Люси': 'Lucy',
  'Варвара': 'Varvara',
  'Глаша': 'Glasha',
  'Лора': 'Lora',
  'Варя': 'Varya',
  'Иоланта': 'Iolanta',
  'Влада': 'Vlada',
  'Лиля': 'Lilya',
  'Тина': 'Tina',
  'Виталина': 'Vitalina',
  'Аника': 'Anica',
  'Терри': 'Terry',
  'Гертруда': 'Gertruda',
  'Наташа': 'Natasha',
  'Риа': 'Ria',
  'Мариами': 'Mariami',
  'Валентина': 'Valentina',
  'Ната': 'Nata',
  'Лида': 'Lida',
  'Пилар': 'Pilar',
  'Брэдли': 'Bradley',
  'Лила': 'Lila',
  'Мина': 'Mina',
  'Лусин': 'Lusin',
  'Мери': 'Meri',
  'Сатеник': 'Satenik',
  'Орнелла': 'Ornella',
  'Даная': 'Danaya',
  'Таисия': 'Taisiya',
  'Евгения': 'Evgeniya',
  'Люсин': 'Lusin',
  'Мариами': 'Mariami',
  'Мос': 'Mos',
  'Маруся': 'Marusya',
  'Аля': 'Alya',
  'Ксения': 'Kseniia',
  'Лана': 'Lana',
  'Тамерлан': 'Tamerlan',
  'Анастасия': 'Anastasia',
  'Мария': 'Maria',
  'Санта': 'Santa',
  'Ева': 'Eva',
  'Лана': 'Lana',
  'Веро': 'Vero',
  'Тати': 'Tati',
  // Мужские имена (одиночные)
  'Валерий': 'Valeriy',
  'Борис': 'Boris',
  'Федор': 'Fedor',
  'Михаил': 'Mikhail',
  'Миша': 'Misha',
  'Андрей': 'Andrey',
  'Дима': 'Dima',
  'Егор': 'Egor',
  'Александр': 'Aleksandr',
  'Алексей': 'Alexey',
  'Виталий': 'Vitaly',
  'Тимур': 'Timur',
  'Мирослав': 'Miroslav',
  'Максим': 'Maksim',
  'Роман': 'Roman',
  'Богдан': 'Bogdan',
  'Иван': 'Ivan',
  'Сеня': 'Senya',
  'Григорий': 'Grigoriy',
  'Марк': 'Mark',
  'Влад': 'Vlad',
  'Игорь': 'Igor',
  'Никита': 'Nikita',
  'Арчи': 'Archi',
  'Коля': 'Kolya',
  'Павел': 'Pavel',
  'Савелий': 'Saveliy',
  'Денис': 'Denis',
  'Макс': 'Maks',
  'Дамир': 'Damir',
  'Дон': 'Don',
  'Салам': 'Salam',
  'Глеб': 'Gleb',
  'Николай': 'Nikolay',
  'Эрик': 'Erik',
  'Степан': 'Stepan',
  'Сергей': 'Sergey',
  'Армен': 'Armen',
  'Данил': 'Danil',
  'Захар': 'Zahar',
  'Джавид': 'Javid',
  'Гордей': 'Gordey',
  'Рамин': 'Ramin',
  'Гоша': 'Gosha',
  'Слава': 'Slava',
  'Вадим': 'Vadim',
  'Константин': 'Konstantin',
  'Аркадий': 'Arkady',
  'Кирилл': 'Kirill',
  'Дмитрий': 'Dmitriy',
  'Артур': 'Artur',
  'Джейден': 'Jaden',
  'Стив': 'Steve',
  'Ги': 'Gui',
  'Василий': 'Vasiliy',
  'Диого': 'Diogo',
  'Амин': 'Amin',
  'Илья': 'Ilya',
  'Тоша': 'Tosha',
  'Лео': 'Leo',
  'Тамерлан': 'Tamerlan',
  'Чай': 'Chai',
  'Ярослав': 'Yaroslav',
  'Дочь Олега': 'Doch Olega',
  'Эрнест': 'Ernest',
  'Софи': 'Sofi',
  'Лев': 'Lev',
  'Мариами': 'Mariami',

  // ── Характеристики внешности ────────────────────────────────
  'Голубо-серые': 'Blue gray',
  'Каштановые': 'Brown',
  'Коричневые': 'Brown',
  'Русые': 'Light brown',
  'Ореховые': 'Hazel',
  'Темный блонд': 'Dark Blond',
  'Серо-голубые': 'Grey-blue',
  'Голубые': 'Blue',
  'Зеленые': 'Green',
  'Рыжие': 'Red',
  'Брюнет': 'Brown',
  'Шатен': 'Brown',
  'Карие': 'Brown',
  'Серые': 'Grey',
  'Блонд': 'Blond',
  'Рыжий': 'Red',
  'Карии': 'Brown',
  'Черные': 'Black',

  // ── UI / формы / навигация ──────────────────────────────────
  'Забукировать': 'booking',
  'Отправлено!': 'Sent!',
  'Наша миссия': 'Our mission',
  'НАШи услуги': 'Our Services',
  'Не принимаю': 'I do not accept',
  'Имя | Name': 'Имя | Name',
  'больше 180': 'more than 180',
  'больше 105': 'more than 105',
  'новые лица': 'New face',
  'Организуем': 'We organize',
  'больше 190': 'more than 190',
  'меньше 170': 'less than 170',
  'Подбираем': 'Picking up',
  'Обсуждаем': 'Discussing',
  'Выполняем': 'We perform',
  'Наша цель': 'Our goal',
  'лидерство': 'leadership',
  'больше 85': 'higher than 85',
  'отправить': 'send',
  'меньше 75': 'less than 75',
  'больше 65': 'higher than 65',
  'больше 95': 'more than 95',
  'Цвет глаз': 'Eyes color',
  'Артикул:': 'Product Code:',
  'продакшн': 'Production',
  'основные': 'general controls',
  'Ваше имя': 'Your name',
  'сентябрь': 'September',
  'Принимаю': 'I accept',
  'Найдено:': 'Found:',
  'контакты': 'contacts',
  'Фильтры': 'Filters',
  'декабрь': 'December',
  'октябрь': 'October',
  'февраль': 'February',
  'девушки': 'women',
  'ПРИВОЗ': 'DIRECT',
  'Волосы': 'Hair',
  'Сумма:': 'Amount:',
  'ноябрь': 'November',
  'август': 'August',
  'январь': 'January',
  'апрель': 'April',
  'о нас': 'About us',
  'парни': 'Men',
  'Бедра': 'Hips',
  'Талия': 'Waist',
  'Далее': 'Next',
  'Грудь': 'Bust',
  'Глаза': 'Eyes',
  'Обувь': 'Shoes',
  'март': 'March',
  'июль': 'July',
  'июнь': 'June',
  'Бюст': 'Bust',
  'Рост': 'Height',
  'май': 'May',
  'чт': 'Thu',
  'ср': 'Wed',
  'сб': 'Sat',
  'вс': 'Sun',
  'р.': 'rub.',
  'пн': 'Mon',
  'вт': 'Tue',
  'пт': 'Fri',

  // ── Прочее / дублирующиеся строки ──────────────────────────
  'международные': 'international',
  'Загрузить еще': 'Load more',
  'предоставляем': 'We provide',
  'Размер обуви': 'Shoes',
  'съемочный процесс': 'filming process',
  'Избранные модели': 'Featured models',
  'Связаться с нами': 'Contact us',
  'пост-продакшн и': 'post productuon and',
  'Социальные сети': 'Social Networking',
  'Кастинг моделей': 'Model casting',
  'готовый контент': 'Prepend content',
  'Как мы работаем': 'How we work',
  'Итоговая сумма:': 'Total amount:',
  'Номер телефона': 'Phone number',
  'Форма кастинга': 'Casting form',
  'Бриф на съемку': 'Shooting brief',
  'Оформить заказ': 'Place an order',
  'OPENUP магазин': 'OPENUP shop',
  'Возраст | Age': 'Возраст | Age',
  'Город | City': 'Город | City',
  'Очистить все': 'Clear All',
  'Я согласен с': 'I consent to the',
  'бронь модели': 'booking model',
  'Отправить еще раз': 'Send again',
  'В нашей команде —': 'In our team',
  'для связи с нами': 'to contact Us',
  'Заполнить анкету': 'Fill out the form',
  'Форма не актуальна': 'Form is not relevant',
  'Сообщить о нарушении': 'Report a violation',
  'Скачать презентацию': 'Download the presentation',
  'бронировать модель': 'booking model',
  'Съемки за границей': 'Shooting abroad',
  'международные парни': 'international men',
  'международные девушки': 'international women',
  'Мы готовы реализовать': 'We are ready to implement',
  'Телефон | Phone number': 'Телефон | Phone number',
  'Контактные данные модели': 'Model Contact Details',
  'конкурентное преимущество': 'competitive advantage',
  'самые амбициозные проекты': 'the most ambitious projects',
  'Прямые контакты для связи:': 'Direct contacts:',
  'Полный цикл продакшн-услуг': 'Full cycle of production services',
  'локации, моделей и команду': 'locations, models and team',
  'Съемки лукбуков и кампейнов': 'Lookbook & Campaign Shootings',
  'Видео и контент для соцсетей': 'Social Media Videos & Content',
  'События и мероприятия OPENUP': 'OPENUP Events and Activities',
  'Забукировать модель': 'Booking model',
  'Мари': 'Marie',
  'Гаухар': 'Gaukhar',
  'Мос': 'Mos',
  'Джейден': 'Jaden',
  'Урсула': 'Ursula',
  'Тамерлан': 'Tamerlan',
  'Мариами': 'Mariami',
  'Арчи': 'Archi',
  'Санта': 'Santa',
  'Ева': 'Eva',
  'Лев': 'Lev',
  'Ги': 'Gui',
  'Диого': 'Diogo',
  'Амин': 'Amin',
  'Тоша': 'Tosha',
  'Лео': 'Leo',
  'Мос': 'Mos',
  'Туяна': 'Tuyana',
  'Ньяша': 'Nyasha',
  'Даная': 'Danaya',
  'Мариам': 'Mariam',
  'Иоланта': 'Iolanta',
  'Аника': 'Anica',
  'Веро': 'Vero',
  'Тати': 'Tati',
  'Лисси': 'Lissy',
  'Лила': 'Lila',
  'Орнелла': 'Ornella',
  'Сатеник': 'Satenik',
  'Мери': 'Meri',
  'Мина': 'Mina',
  'Люсин': 'Lusin',
  'Батура': 'Batura',
};
// ============================================================
//  РЕГИСТР
// ============================================================

function detectCase(str) {
  const letters = str.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (!letters) return 'lower';
  if (letters === letters.toUpperCase()) return 'upper';
  if (
    letters[0] === letters[0].toUpperCase() &&
    letters.slice(1) === letters.slice(1).toLowerCase()
  )
    return 'title';
  if (letters === letters.toLowerCase()) return 'lower';
  return 'mixed';
}

function applyCase(translation, profile) {
  switch (profile) {
    case 'upper':
      return translation.toUpperCase();
    case 'title':
      return (
        translation.charAt(0).toUpperCase() +
        translation.slice(1).toLowerCase()
      );
    case 'lower':
      return translation.toLowerCase();
    default:
      return translation;
  }
}

// ============================================================
//  ПОДГОТОВКА СЛОВАРЕЙ
// ============================================================

// Прямой словарь (RU → EN), ключи приведены к нижнему регистру
const DICT_LOWER = {};
for (const [k, v] of Object.entries(DICTIONARY)) {
  DICT_LOWER[k.toLowerCase()] = v;
}
// Сортировка по убыванию длины: длинные фразы матчим раньше коротких
const DICT_KEYS = Object.keys(DICT_LOWER).sort((a, b) => b.length - a.length);

// Обратный словарь (EN → RU), значения приведены к нижнему регистру
const DICT_REVERSE_LOWER = {};
for (const [k, v] of Object.entries(DICTIONARY)) {
  const vl = v.toLowerCase();
  if (!DICT_REVERSE_LOWER[vl]) DICT_REVERSE_LOWER[vl] = k;
}

// Псевдонимы — дополнительные английские варианты → русский
// (нельзя выразить через DICTIONARY из-за ограничения уникальности ключей)
const DICT_REVERSE_ALIASES = {
  'alexendre': 'Александр',   // дубль: Alexander / Aleksandr
  'alexander': 'Александр',
  'alexandra': 'Александра',  // дубль: Alexandra / Aleksandra
  'alexendra': 'Александра',
  'ksenia': 'Ксения',         // дубль: Ksenia / Kseniia
  'sofiya': 'София',           // дубль: Sofiya / Sofia
  'julia': 'Юлия',             // дубль: Julia / Yulia
  'tatiana': 'Татьяна',        // дубль: Tatiana / Tatyana
  'elizaveta': 'Елизавета',    // дубль: Elizaveta / Elisabeth
  'sophie': 'Софи',            // дубль: Sophie / Sofi
};
Object.assign(DICT_REVERSE_LOWER, DICT_REVERSE_ALIASES);

const DICT_REVERSE_KEYS = Object.keys(DICT_REVERSE_LOWER).sort(
  (a, b) => b.length - a.length,
);

// ============================================================
//  МАТЧИНГ
// ============================================================

// Матчим ключи словаря только как целые токены/фразы,
// чтобы не ломать слова вроде "подростковый" → "подheightковый".
function buildTokenAwareRegex(key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const edge = '[^0-9A-Za-zА-Яа-яЁё]';
  return new RegExp(`(^|${edge})(${escaped})(?=$|${edge})`, 'gi');
}

function translateViaDictReverse(text) {
  const trimmed = text.trim();
  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (DICT_REVERSE_LOWER[lower] !== undefined) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return {
      result:
        lead +
        applyCase(DICT_REVERSE_LOWER[lower], detectCase(normalized)) +
        tail,
      changed: true,
    };
  }

  let result = normalized;
  let changed = false;
  for (const key of DICT_REVERSE_KEYS) {
    result = result.replace(buildTokenAwareRegex(key), (m, lead, found) => {
      changed = true;
      return lead + applyCase(DICT_REVERSE_LOWER[key], detectCase(found));
    });
  }
  if (changed) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return { result: lead + result + tail, changed: true };
  }
  return { result: text, changed: false };
}

function translateViaDict(text) {
  const trimmed = text.trim();
  // Нормализуем пробелы/переносы — Tilda может рендерить текст с \n внутри блока.
  const normalized = trimmed.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (DICT_LOWER[lower] !== undefined) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return {
      result:
        lead + applyCase(DICT_LOWER[lower], detectCase(normalized)) + tail,
      changed: true,
    };
  }

  let result = normalized;
  let changed = false;
  for (const key of DICT_KEYS) {
    result = result.replace(buildTokenAwareRegex(key), (m, lead, found) => {
      changed = true;
      return lead + applyCase(DICT_LOWER[key], detectCase(found));
    });
  }
  if (changed) {
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    return { result: lead + result + tail, changed: true };
  }
  return { result: text, changed: false };
}
// ============================================================
//  MYMEMORY API
// ============================================================

/**
 * MyMemory не поддерживает батч — переводит по одной строке.
 * Запросы запускаются параллельно через Promise.all.
 */
async function fetchMyMemory(text, langpair = 'ru|en') {
  try {
    const params = new URLSearchParams({
      q: text,
      langpair,
      ...(MYMEMORY_EMAIL ? { de: MYMEMORY_EMAIL } : {}),
    });
    const resp = await fetch(
      `https://api.mymemory.translated.net/get?${params}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    // responseStatus 200 = успех, 429 = лимит исчерпан
    if (data.responseStatus !== 200) {
      console.warn(
        '[translate] MyMemory:',
        data.responseStatus,
        data.responseDetails,
      );
      return null;
    }
    return data.responseData.translatedText || null;
  } catch (e) {
    console.warn('[translate] MyMemory fetch error:', e);
    return null;
  }
}

// ============================================================
//  LIBRETRANSLATE API (fallback)
// ============================================================

async function fetchLibre(text, source = 'ru', target = 'en') {
  try {
    const resp = await fetch(LIBRE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: 'text',
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.translatedText || null;
  } catch (e) {
    console.warn('[translate] LibreTranslate fetch error:', e);
    return null;
  }
}

// ============================================================
//  КЭШ + ОСНОВНАЯ ФУНКЦИЯ ПЕРЕВОДА
// ============================================================

let cache = {};
try {
  cache = JSON.parse(localStorage.getItem(STORAGE_KEY_CACHE) || '{}');
} catch (_) {}

function saveCache() {
  try {
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(cache));
  } catch (_) {}
}

/**
 * Переводит один текст: кэш → MyMemory → LibreTranslate.
 * langpair: 'ru|en' (по умолчанию) или 'en|ru' для обратного перевода.
 */
async function translateViaAPI(text, langpair = 'ru|en') {
  const key = langpair + ':' + text.trim();
  if (!text.trim()) return null;
  if (cache[key]) return cache[key];

  if (translateViaAPI.inFlight[key]) {
    return translateViaAPI.inFlight[key];
  }

  const [src, tgt] = langpair.split('|');
  translateViaAPI.inFlight[key] = (async () => {
    let result = await fetchMyMemory(text.trim(), langpair);
    if (!result) result = await fetchLibre(text.trim(), src, tgt);
    if (!result) return null;

    cache[key] = result;
    saveCache();
    return result;
  })();

  try {
    return await translateViaAPI.inFlight[key];
  } finally {
    delete translateViaAPI.inFlight[key];
  }
}
translateViaAPI.inFlight = Object.create(null);

// ============================================================
//  ПРИМЕНЕНИЕ РЕЗУЛЬТАТОВ API К ТЕКСТОВЫМ УЗЛАМ
// ============================================================

async function applyAPI(pendingNodes) {
  if (!pendingNodes.length) return;

  const grouped = new Map();
  for (const item of pendingNodes) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key);
      if (!translation) return;

      for (const { node, originalText } of items) {
        const lead = originalText.match(/^\s*/)[0];
        const tail = originalText.match(/\s*$/)[0];
        node.nodeValue = lead + translation + tail;
      }
    }),
  );
}

async function applyAPIReverse(pendingNodes) {
  if (!pendingNodes.length) return;

  const grouped = new Map();
  for (const item of pendingNodes) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key, 'en|ru');
      if (!translation) return;

      for (const { node, originalText } of items) {
        const lead = originalText.match(/^\s*/)[0];
        const tail = originalText.match(/\s*$/)[0];
        node.nodeValue = lead + translation + tail;
      }
    }),
  );
}

// ============================================================
//  ПРИМЕНЕНИЕ РЕЗУЛЬТАТОВ API К АТРИБУТАМ
// ============================================================

async function applyAPIAttrs(pendingAttrs) {
  if (!pendingAttrs.length) return;

  const grouped = new Map();
  for (const item of pendingAttrs) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key);
      if (!translation) return;

      for (const { el, attr } of items) {
        el.setAttribute(attr, translation);
      }
    }),
  );
}

async function applyAPIAttrsReverse(pendingAttrs) {
  if (!pendingAttrs.length) return;

  const grouped = new Map();
  for (const item of pendingAttrs) {
    const key = item.originalText.trim();
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  const entries = Array.from(grouped.entries()).slice(
    0,
    API_MAX_UNIQUE_PER_PASS,
  );

  await Promise.all(
    entries.map(async ([key, items]) => {
      const translation = await translateViaAPI(key, 'en|ru');
      if (!translation) return;

      for (const { el, attr } of items) {
        el.setAttribute(attr, translation);
      }
    }),
  );
}
// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СТРОК
// ============================================================

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text || '');
}

function hasLatin(text) {
  return /[a-zA-Z]/.test(text || '');
}

function isMainlyRussian(text) {
  // Отправляем в API только текст, в котором кириллицы больше, чем латиницы.
  // Это исключает двуязычные метки вида «Имя | Name», «Telegram username» и т.п.
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[a-zA-Z]/g) || []).length;
  return cyr >= Math.max(lat, 1);
}

function isMainlyEnglish(text) {
  const cyr = (text.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (text.match(/[a-zA-Z]/g) || []).length;
  return lat >= Math.max(cyr, 1);
}

function shouldSendToAPI(text) {
  const trimmed = text.trim();
  if (trimmed.length < API_MIN_TEXT_LENGTH) return false;
  // Пропускаем строки без единой буквы (цифры, символы, пунктуация).
  // Намеренно НЕ используем /u-флаг: \W в unicode-режиме матчит кириллицу как "не \w".
  if (!/[А-Яа-яЁёa-zA-Z]/.test(trimmed)) return false;
  if (API_REQUIRE_CYRILLIC && !hasCyrillic(trimmed)) return false;
  if (!isMainlyRussian(trimmed)) return false;
  return true;
}

function shouldSendToAPIReverse(text) {
  const trimmed = text.trim();
  if (trimmed.length < API_MIN_TEXT_LENGTH) return false;
  if (!hasLatin(trimmed)) return false;
  // Пропускаем email-адреса
  if (trimmed.includes('@')) return false;
  // Пропускаем CSS/код
  if (/[{};]/.test(trimmed)) return false;
  if (!isMainlyEnglish(trimmed)) return false;
  return true;
}

// ============================================================
//  ФИЛЬТРЫ ЭЛЕМЕНТОВ DOM
// ============================================================

function shouldSkip(el) {
  return (
    SKIP_TAGS.has(el.tagName) ||
    el.hasAttribute('data-skip-translate') ||
    el.classList.contains('ru-btn') ||
    el.classList.contains('en-btn')
  );
}

function isInTranslateScope(el) {
  if (!TRANSLATE_SCOPE_SELECTORS.length) return true;
  const selector = TRANSLATE_SCOPE_SELECTORS.join(', ');
  if (el.closest(selector)) return true;
  return !document.querySelector(selector);
}

function isExcludedElement(el) {
  if (!EXCLUDED_SELECTOR) return false;
  return !!el.closest(EXCLUDED_SELECTOR);
}

function isContentElement(el) {
  if (!CONTENT_SELECTOR) return true;
  return !!el.closest(CONTENT_SELECTOR);
}

function isVisible(el) {
  if (!TRANSLATE_ONLY_VISIBLE) return true;
  if (!el || !el.isConnected) return false;
  if (el.closest('[hidden]')) return false;

  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return true;
}

function shouldTranslateElement(el) {
  if (!el) return false;
  if (!isInTranslateScope(el)) return false;
  if (shouldSkip(el)) return false;
  if (isExcludedElement(el)) return false;
  if (!isContentElement(el)) return false;
  if (!isVisible(el)) return false;
  return true;
}

function getTranslationRoots(root) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return [];
  if (!TRANSLATE_SCOPE_SELECTORS.length) return [root];

  const selector = TRANSLATE_SCOPE_SELECTORS.join(', ');
  const candidates = [];

  if (root.matches && root.matches(selector)) {
    candidates.push(root);
  }

  if (root.querySelectorAll) {
    candidates.push(...root.querySelectorAll(selector));
  }

  if (!candidates.length && root.closest && root.closest(selector)) {
    candidates.push(root);
  }

  const unique = [];
  for (const candidate of candidates) {
    if (!candidate || unique.includes(candidate)) continue;
    unique.push(candidate);
  }

  return unique.filter((candidate) => {
    return !unique.some(
      (other) => other !== candidate && other.contains(candidate),
    );
  });
}

// ============================================================
//  АТРИБУТЫ: КЛЮЧИ ДЛЯ ХРАНЕНИЯ ОРИГИНАЛЬНЫХ ЗНАЧЕНИЙ
// ============================================================

function getAttrOriginalKey(attr) {
  return `${ATTR_ORIGINAL_ATTR_PREFIX}${attr}`;
}

function getAttrOriginalEnKey(attr) {
  return `${ATTR_ORIGINAL_EN_ATTR_PREFIX}${attr}`;
}

function canTranslateValueAttr(el) {
  if (el.tagName !== 'INPUT') return false;
  const type = (el.getAttribute('type') || '').toLowerCase();
  return type === 'button' || type === 'submit' || type === 'reset';
}
// ============================================================
//  ПЕРЕВОД АТРИБУТОВ
// ============================================================

async function processAttributes(root, lang) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

  const roots = getTranslationRoots(root);
  if (!roots.length) return;

  const needAPI = [];
  const needAPIReverse = [];

  for (const scopeRoot of roots) {
    const elements = [scopeRoot, ...scopeRoot.querySelectorAll('*')];

    for (const el of elements) {
      if (!shouldTranslateElement(el)) continue;

      for (const attr of TRANSLATABLE_ATTRIBUTES) {
        if (!el.hasAttribute(attr)) continue;
        if (attr === 'value' && !canTranslateValueAttr(el)) continue;

        const current = el.getAttribute(attr) || '';
        if (!current.trim()) continue;

        const origKey   = getAttrOriginalKey(attr);
        const origEnKey = getAttrOriginalEnKey(attr);

        if (lang === 'ru') {
          // Восстанавливаем из RU-оригинала (если был перевод RU→EN)
          if (el.hasAttribute(origKey)) {
            el.setAttribute(attr, el.getAttribute(origKey));
            el.removeAttribute(origKey);
            continue;
          }
          // Обратный перевод EN→RU для изначально английских значений
          if (!hasCyrillic(current) && hasLatin(current)) {
            if (!el.hasAttribute(origEnKey)) {
              el.setAttribute(origEnKey, current);
            }
            const origEn = el.getAttribute(origEnKey) || current;
            const { result, changed } = translateViaDictReverse(origEn);
            if (changed) {
              el.setAttribute(attr, result);
              if (hasLatin(result) && shouldSendToAPIReverse(result)) {
                needAPIReverse.push({ el, attr, originalText: origEn });
              }
            } else if (shouldSendToAPIReverse(origEn)) {
              needAPIReverse.push({ el, attr, originalText: origEn });
            }
          }
          continue;
        }

        // EN-режим: сохраняем оригинал и переводим RU→EN
        if (!el.hasAttribute(origKey)) {
          el.setAttribute(origKey, current);
        }

        const original = el.getAttribute(origKey) || current;

        if (!/[А-Яа-яЁё]/.test(original)) continue;

        const { result, changed } = translateViaDict(original);
        if (changed) {
          el.setAttribute(attr, result);

          // Если словарь перевёл только часть текста, добиваем остаток через API.
          if (hasCyrillic(result) && shouldSendToAPI(original)) {
            needAPI.push({ el, attr, originalText: original });
          }
        } else if (shouldSendToAPI(original)) {
          needAPI.push({ el, attr, originalText: original });
        }
      }
    }
  }

  await applyAPIAttrs(needAPI);
  await applyAPIAttrsReverse(needAPIReverse);
}

// ============================================================
//  ПЕРЕВОД ТЕКСТОВЫХ УЗЛОВ
// ============================================================

async function processNode(root, lang) {
  const roots = getTranslationRoots(root);
  if (!roots.length) {
    if (lang === 'en') console.log('[translate] no roots for node:', root);
    return;
  }

  const nodes = [];
  for (const scopeRoot of roots) {
    const walker = document.createTreeWalker(
      scopeRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_SKIP;

          const baseEl = node.parentElement;
          if (!baseEl) return NodeFilter.FILTER_SKIP;
          if (!shouldTranslateElement(baseEl)) return NodeFilter.FILTER_SKIP;

          let el = baseEl.parentElement;
          while (el) {
            if (shouldSkip(el)) return NodeFilter.FILTER_SKIP;
            if (isExcludedElement(el)) {
              console.log('[translate] ancestor excluded:', el.className || el.tagName, '→ skipped text:', JSON.stringify(node.nodeValue.trim().slice(0, 40)));
              return NodeFilter.FILTER_SKIP;
            }
            el = el.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) nodes.push(walker.currentNode);
  }

  // ── Откат на RU / обратный перевод EN→RU ──
  if (lang === 'ru') {
    const needAPIReverse = [];

    for (const node of nodes) {
      const el = node.parentElement;
      if (el && el.hasAttribute(ATTR_ORIGINAL)) {
        // Восстановить русский оригинал (был переведён в EN-режиме)
        node.nodeValue = el.getAttribute(ATTR_ORIGINAL);
        el.removeAttribute(ATTR_ORIGINAL);
      } else {
        // Обратный перевод: английский текст → русский
        const text = node.nodeValue;
        if (!hasCyrillic(text) && hasLatin(text)) {
          // Сохраняем английский оригинал только если ещё не сохранён
          if (el && !el.hasAttribute(ATTR_ORIGINAL_EN)) {
            el.setAttribute(ATTR_ORIGINAL_EN, text);
          }
          const origEn = (el && el.getAttribute(ATTR_ORIGINAL_EN)) || text;
          const { result, changed } = translateViaDictReverse(origEn);
          if (changed) {
            node.nodeValue = result;
            if (hasLatin(result) && shouldSendToAPIReverse(result)) {
              needAPIReverse.push({ node, originalText: origEn });
            }
          } else if (shouldSendToAPIReverse(origEn)) {
            needAPIReverse.push({ node, originalText: origEn });
          }
        }
      }
    }

    await applyAPIReverse(needAPIReverse);
    await processAttributes(root, 'ru');
    return;
  }

  // ── Перевод на EN ──
  const needAPI = [];

  for (const node of nodes) {
    const el = node.parentElement;
    if (!el.hasAttribute(ATTR_ORIGINAL)) {
      el.setAttribute(ATTR_ORIGINAL, node.nodeValue);
    }

    const original = node.nodeValue;
    if (!hasCyrillic(original)) continue;
    const { result, changed } = translateViaDict(original);

    if (changed) {
      node.nodeValue = result;

      // Если после словаря осталась кириллица, отправляем до-перевод в API.
      if (hasCyrillic(result) && shouldSendToAPI(original)) {
        needAPI.push({ node, originalText: original });
      }
    } else {
      if (shouldSendToAPI(original)) {
        needAPI.push({ node, originalText: original });
      } else if (hasCyrillic(original)) {
        console.log(
          '[translate] API skipped for:', JSON.stringify(original.trim().slice(0, 60)),
          '| cyr:', (original.match(/[А-Яа-яЁё]/g) || []).length,
          '| lat:', (original.match(/[a-zA-Z]/g) || []).length,
          '| len:', original.trim().length,
        );
      }
    }
  }

  console.log(
    '[translate] roots:', roots.length,
    'text nodes:', nodes.length,
    'api queue:', needAPI.length,
  );

  await applyAPI(needAPI);
  await processAttributes(root, 'en');
}
// ============================================================
//  СОСТОЯНИЕ ЯЗЫКА
// ============================================================

let currentLang;
try {
  currentLang = localStorage.getItem(STORAGE_KEY_LANG) || DEFAULT_LANG;
} catch (_) {
  currentLang = DEFAULT_LANG;
}
let observer = null;

// ============================================================
//  КНОПКИ ПЕРЕКЛЮЧЕНИЯ
// ============================================================

function setActiveButton(lang) {
  document
    .querySelectorAll('.ru-btn')
    .forEach((el) => el.classList.toggle('active', lang === 'ru'));
  document
    .querySelectorAll('.en-btn')
    .forEach((el) => el.classList.toggle('active', lang === 'en'));
}

async function switchLanguage(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  } catch (_) {}
  setActiveButton(lang);
  try {
    await processNode(document.body, lang);
  } catch (err) {
    console.error('[translate] switchLanguage failed:', err);
  }
}

// ============================================================
//  MUTATION OBSERVER — попапы, слайдеры, табы
// ============================================================

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        processNode(added, currentLang).catch((err) => {
          console.error('[translate] mutation translate failed:', err);
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
//  ОБРАБОТЧИКИ КЛИКОВ
// ============================================================

function bindButtons() {
  function scheduleSwitch(lang) {
    // Запускаем перевод после завершения текущего цикла клика,
    // чтобы не ломать внутренние обработчики Tilda.
    setTimeout(() => {
      switchLanguage(lang);
    }, 0);
  }

  document.addEventListener('click', (e) => {
    const ruBtn = e.target.closest('.ru-btn');
    const enBtn = e.target.closest('.en-btn');

    if (ruBtn) {
      console.log('[translate] ru-btn clicked');
      scheduleSwitch('ru');
    }
    if (enBtn) {
      console.log('[translate] en-btn clicked');
      scheduleSwitch('en');
    }
  });
}

// ============================================================
//  СТИЛИ АКТИВНОЙ КНОПКИ
// ============================================================

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .ru-btn.active .tn-atom__button-text,
    .en-btn.active .tn-atom__button-text {
      color: #9E9E9E !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

function init() {
  console.log('[translate] 🚀 init started, lang:', currentLang);

  injectStyles();
  console.log('[translate] ✅ styles injected');

  bindButtons();
  console.log('[translate] ✅ buttons bound');

  startObserver();
  console.log('[translate] ✅ observer started');

  if (currentLang === 'en') {
    setActiveButton('en');
    console.log('[translate] ✅ active button set → EN');
    setTimeout(() => {
      console.log('[translate] ⏳ starting page translation...');
      processNode(document.body, 'en').then(() => {
        console.log('[translate] ✅ page translation done');
      });
    }, 400);
  } else {
    setActiveButton('ru');
    console.log('[translate] ✅ active button set → RU');
    // При старте в RU-режиме страница уже на русском — переводить нечего.
    // Обратный перевод EN→RU нужен только при явном переключении языка пользователем.
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
