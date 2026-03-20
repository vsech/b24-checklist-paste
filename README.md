# Checklist Paste Extension

Расширение добавляет две доработки для V2-чеклистов в карточке задачи Bitrix24:

- вставка многострочного списка из буфера обмена как нескольких пунктов чеклиста
- визуальная автонумерация пунктов без изменения текста

## Структура

```text
/local/js/vendor/checklist-paste/
  script.js
  config.php
  README.md
```

## Что делает `script.js`


- ждёт загрузки V2-расширений чеклиста
- перехватывает `paste` в `GrowingTextArea`
- разбивает многострочный список на отдельные checklist items
- оставляет первую строку в текущем пункте
- создаёт остальные строки как новые пункты сразу после текущего
- добавляет визуальную нумерацию через CSS counters

## Создать `config.php`

Создайте рядом файл `config.php` со следующим содержимым:

```php
<?php

if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

return [
	'js' => '/local/js/vendor/checklist-paste/script.js',
	'rel' => [
		'tasks.v2.component.elements.growing-text-area',
		'tasks.v2.component.fields.check-list',
	],
	'skip_core' => false,
];
```

Имя расширения будет `vendor.checklist-paste`.

## Подключение

Подключайте расширение на странице, где рендерится карточка задачи или side panel с задачей:

```php
\Bitrix\Main\UI\Extension::load('vendor.checklist-paste');
```

Если нужен быстрый тест, можно временно подключить через `/local/php_interface/init.php`:

```php
<?php

use Bitrix\Main\UI\Extension;

AddEventHandler('main', 'OnProlog', static function () {
	Extension::load('vendor.checklist-paste');
});
```

Глобальное подключение через `init.php` лучше использовать только для проверки. Для постоянной доработки лучше грузить расширение в конкретном компоненте/шаблоне карточки задачи.

## Проверка в браузере

Откройте полную карточку задачи и выполните в консоли:

```js
typeof BX?.Tasks?.V2?.Component?.Elements?.GrowingTextArea?.getPastedChecklistItems
```

Ожидаемый результат:

```js
'function'
```

Проверка парсинга:

```js
BX.Tasks.V2.Component.Elements.GrowingTextArea.getPastedChecklistItems(`•	11
•	22
•	33`)
```

Ожидаемый результат:

```js
["11", "22", "33"]
```

Проверка в UI:

1. Откройте задачу в full card.
2. Поставьте курсор в дочерний пункт чеклиста.
3. Вставьте список:

```text
• 11
• 22
• 33
• 44
• 55
```

Ожидаемое поведение:

- в текущем пункте останется `11`
- ниже появятся ещё 4 новых пункта
- слева у пунктов будет видна автонумерация

## Ограничения

- Патч рассчитан на V2-чеклист карточки задачи.
- Старый `BX.Tasks.CheckListItem` не используется.
- Нумерация только визуальная и не записывается в заголовок пункта.
