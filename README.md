# rto-form-popups

Lightweight jQuery-based system for managing popups, forms, scroll-locking and reCAPTCHA.

## Table of Contents

- [Dependencies](#dependencies)
- [WowRecaptcha](#wowrecaptcha)
- [WowScrollLock](#wowscrolllock)
- [WowForm](#wowform)
- [WowPopup](#wowpopup)
- [template-form.blade.php](#template-formbladephp)
- [JS Usage Examples](#js-usage-examples)
- [Expected HTML Structure](#expected-html-structure)

---

## Dependencies

- jQuery
- [Inputmask](https://github.com/RobinHerbots/Inputmask)
- Google reCAPTCHA v2 (invisible) — loaded automatically

---

## Modules

### WowRecaptcha

Global reCAPTCHA loader and renderer. Lazily loads the reCAPTCHA script when a `form[method="post"]` enters the viewport using `IntersectionObserver`. Renders captcha on any such form that contains a `.captcha` element.

**Auto-initializes** from `<html data-sitekey="...">`. Manual init is also available.

```js
// Manual init (optional if data-sitekey is set)
WowRecaptcha.init('your-sitekey-here');
```

#### Methods

| Method | Description |
|---|---|
| `init(sitekey)` | Set the sitekey and start observing forms |
| `isLoaded()` | Returns `true` if the reCAPTCHA script has loaded |
| `load()` | Manually trigger script loading (called automatically by WowPopup on show) |
| `renderForms()` | Render captcha on all unrendered `form[method="post"]` with `.captcha` |
| `onLoad()` | Internal callback for the reCAPTCHA script — not called manually |

---

### WowScrollLock

Centralised scroll-lock with iOS scroll-position preservation. Only one lock can be active at a time.

Adds/removes the `scrolllock-on` class on `<body>` and preserves `window.scrollY` via `body.style.top`.

#### Methods

| Method | Description |
|---|---|
| `lock()` | Lock scrolling |
| `unlock()` | Unlock scrolling and restore scroll position |
| `isLocked()` | Returns `true` if scroll is currently locked |

---

### WowForm

Standalone form handler. Manages input masks, field states (focused/has-value), email validation, native validation error marking, reCAPTCHA execution and AJAX submission.

Can be used independently or created automatically via `WowPopup`.

```js
new WowForm(name, options);
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `name` | string | **Required.** Unique identifier for the form instance |
| `options` | object | Optional. Configuration object (see below) |

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `containerId` | string | `'#form-{name}'` | Selector for the element wrapping the `<form>` |
| `beforePost` | function(form, data) | `null` | Modify serialized form data before POST. Return the modified string |
| `onSuccess` | function(form, resp) | `null` | Called when the server returns `resp.success === true` |
| `onError` | function(form, resp) | `null` | Called on `resp.success === false` or request failure. `resp` is `null` on network failure |

#### Methods

| Method | Description |
|---|---|
| `WowForm.get(name)` | Static. Returns the WowForm instance by name, or `null` |
| `reset()` | Reset the form, field states and captcha |
| `destroy()` | Unbind all events and remove from registry |

#### Server response

The form expects a JSON response from the server. A successful response must include `{ "success": true }`. Any other response triggers the error flow.

#### Example

```js
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        $('#newsletter-signup').html('<p>Thanks!</p>');
    },
});

// Access later
WowForm.get('newsletter').reset();
```

---

### WowPopup

Popup lifecycle manager. Handles show, hide, toggle, scroll-locking and auto-show timing. Only one popup can be visible at a time — showing a new popup hides the active one.

Can optionally create and manage a `WowForm` instance internally.

```js
new WowPopup(name, options);
```

#### Parameters

| Parameter | Type | Description |
|---|---|---|
| `name` | string | **Required.** Unique identifier for the popup instance |
| `options` | object | Optional. Configuration object (see below) |

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `popupId` | string | `'#popup-{name}'` | Selector for the popup element |
| `toggleClasses` | string | `null` | Additional toggle trigger selectors (comma-separated). `.toggle-{name}-popup` is always registered |
| `resetOnHide` | boolean | `true` | Reset `.popup-content` visibility and associated form on hide |
| `form` | object / true | `null` | WowForm options. Pass `true` or `{}` for defaults. See Form sub-options below |
| `autoShow` | object / true | `null` | Auto-show configuration. Pass `true` or `{}` for immediate show. See AutoShow sub-options below |
| `onShow` | function(popup) | `null` | Called after the popup is shown |
| `onHide` | function(popup) | `null` | Called after the popup is hidden |

#### Form sub-options (`form: { ... }`)

Creates a `WowForm` instance with `containerId` defaulting to the popup element.

When created via WowPopup, the default `onSuccess` toggles `.popup-default` / `.popup-thanks` inside the popup.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | string | Same as popup name | WowForm instance name, used for registry and reset-on-hide lookup |
| `containerId` | string | Same as `popupId` | Selector for the element wrapping the `<form>` |
| `beforePost` | function(form, data) | `null` | Modify serialized form data before POST |
| `onSuccess` | function(form, resp) | Toggles `.popup-default` / `.popup-thanks` | Called on `resp.success === true` |
| `onError` | function(form, resp) | `null` | Called on failure |

#### AutoShow sub-options (`autoShow: { ... }`)

Automatically shows the popup after a delay. Skipped if another popup is already active.

| Option | Type | Default | Description |
|---|---|---|---|
| `delay` | number | `0` | Milliseconds to wait before showing |
| `showOnce` | boolean | `false` | Show only once per session. Stores `wowpopup-{name}` in `sessionStorage` on hide |

#### Methods

| Method | Description |
|---|---|
| `WowPopup.get(name)` | Static. Returns the WowPopup instance by name, or `null` |
| `show()` | Show the popup. Hides any other active popup first |
| `hide()` | Hide the popup |
| `resetPopup()` | Reset popup view state and associated form |
| `destroy()` | Hide, unbind all events and remove from registry |

#### Built-in behaviour

- Clicking `.toggle-{name}-popup` (and any `toggleClasses`) toggles the popup
- Clicking `.popup-close` inside the popup hides it
- `WowScrollLock.lock()` is called on show, `unlock()` on hide
- Patches jQuery's `.show()`, `.hide()`, `.toggle()` to fire events — so calling `$('#popup-march').toggle()` from external code is automatically captured. Scroll lock, `_active` tracking and `.popup-close` all work regardless of how the popup was shown

---

## template-form.blade.php

Reusable Blade partial for rendering lead capture forms. Include anywhere with `@include('partials.template-form', [...])`.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | string | **Yes** | — | Source identifier for the lead (hidden field) |
| `smart_id` | string | No | `''` | Smart ID for tracking (hidden field) |
| `action` | string | No | `'/submitLead'` | Form action URL |
| `hidden_fields` | array | No | `[]` | Additional hidden fields as `['name' => 'value', ...]` |
| `rows` | array | No | Default fields | Override default field rows entirely |
| `excluded_fields` | array | No | `[]` | Field names to remove from defaults |
| `submit_text` | string | No | `'Submit'` | Submit button label |
| `submit_class` | string | No | `''` | Extra classes on the submit button |
| `tabindex_start` | int | No | `40` | Starting tabindex |

### Default fields

When `rows` is not provided, the form renders these default rows:

| Row | Fields |
|---|---|
| 1 | `first_name` (text, required), `last_name` (text, required) |
| 2 | `email` (email, required), `phone` (tel, required — auto-masked) |
| 3 | `store` (select, required — uses `$stores` collection) |
| 4 | `message` (text) |

### Row / field structure

`rows` is an array of rows. Each row is an array of fields. A row with a single field spans full width; multiple fields share the row equally.

```php
'rows' => [
    // Row 1: two fields side by side
    [
        ['name' => 'first_name', 'label' => 'First Name', 'required' => true],
        ['name' => 'last_name',  'label' => 'Last Name',  'required' => true],
    ],
    // Row 2: single field, full width
    [
        ['name' => 'message', 'label' => 'Message'],
    ],
]
```

### Field definition

| Key | Type | Default | Description |
|---|---|---|---|
| `name` | string | **Required** | Input name attribute |
| `type` | string | `'text'` | Supports: `text`, `email`, `tel`, `select` |
| `label` | string | ucwords of `name` | Label text |
| `required` | bool | `false` | Makes the field required |
| `options` | array | `[]` | Key-value pairs for `select` type (except `store`, which uses `$stores`) |
| `inputmask` | string | Auto for `tel` | Inputmask data attribute |
| `pattern` | string | Auto for `tel` | HTML pattern attribute |
| `attributes` | string | `''` | Raw extra HTML attributes |

### Built-in behaviour

- `_token` (CSRF), `source`, and `smart_id` hidden fields are always rendered
- `tel` fields automatically get the mask `(999) 999-9999` and matching pattern
- The `store` select always populates from the `$stores` Eloquent collection (`$store->id`, `$store->name`)
- All other selects use the `options` array from the field definition
- Every select starts with an empty disabled/hidden placeholder option

### Usage examples

#### All defaults

```blade
@include('partials.template-form', [
    'source' => 'contact-page',
])
```

#### With smart_id

```blade
@include('partials.template-form', [
    'source'   => 'contact-page',
    'smart_id' => $smart_id,
])
```

#### Exclude fields

```blade
@include('partials.template-form', [
    'source'          => 'contact-page',
    'excluded_fields' => ['phone', 'store'],
])
```

#### Custom submit button

```blade
@include('partials.template-form', [
    'source'       => 'request-page',
    'submit_text'  => 'Send Request',
    'submit_class' => 'bg-red white',
])
```

#### Extra hidden fields

```blade
@include('partials.template-form', [
    'source'        => 'promo-page',
    'hidden_fields' => ['campaign' => 'summer-sale', 'ref' => 'banner'],
])
```

#### Custom action

```blade
@include('partials.template-form', [
    'source' => 'inquiry-page',
    'action' => '/custom-endpoint',
])
```

#### Fully custom rows

```blade
@include('partials.template-form', [
    'source' => 'quote-page',
    'rows'   => [
        [
            ['name' => 'company', 'label' => 'Company Name', 'required' => true],
            ['name' => 'website', 'label' => 'Website'],
        ],
        [
            ['name' => 'budget', 'label' => 'Budget', 'type' => 'number'],
        ],
    ],
])
```

#### Custom select in custom rows

```blade
@include('partials.template-form', [
    'source' => 'feedback-page',
    'rows'   => [
        [
            ['name' => 'first_name', 'label' => 'First Name', 'required' => true],
            ['name' => 'last_name',  'label' => 'Last Name',  'required' => true],
        ],
        [
            ['name' => 'department', 'type' => 'select', 'label' => 'Department', 'required' => true,
             'options' => ['sales' => 'Sales', 'support' => 'Support', 'other' => 'Other']],
        ],
    ],
])
```

#### Custom tabindex start (multiple forms on one page)

```blade
@include('partials.template-form', [
    'source'          => 'sidebar',
    'tabindex_start'  => 80,
    'excluded_fields' => ['message', 'store'],
])
```

---

## JS Usage Examples

### Standalone form (no popup)

```js
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        $('#newsletter-signup').html('<p>Thanks for subscribing!</p>');
    },
    onError: function (form, resp) {
        alert('Something went wrong, please try again.');
    },
});
```

### Popup without a form

```js
new WowPopup('gallery');
```

### Popup with a form (all defaults)

The simplest way — `form: true` creates a WowForm with default options. On success, `.popup-default` hides and `.popup-thanks` shows automatically.

```js
new WowPopup('request', { form: true });
```

### Popup with custom form options

```js
new WowPopup('contact', {
    toggleClasses: '.cta-contact, #footer-contact-link',
    form: {
        beforePost: function (form, data) {
            return data + '&source=website';
        },
        onSuccess: function (form, resp) {
            alert('Message sent!');
        },
        onError: function (form, resp) {
            alert('Failed to send, please try again.');
        },
    },
});
```

### Multiple toggle triggers

The default toggle class `.toggle-{name}-popup` is always registered. Use `toggleClasses` for additional triggers.

```js
new WowPopup('signup', {
    toggleClasses: '.hero-cta, .sidebar-cta, #exit-intent-trigger',
    form: true,
});
```

### Form triggers a separate popup on success

```js
new WowPopup('thanks');
new WowForm('contact-inline', {
    containerId: '#contact-section',
    onSuccess: function () {
        WowPopup.get('thanks').show();
    },
});
```

### Popup + Form created separately

When you need the form name or container to differ from the popup.

```js
new WowPopup('inquiry');
new WowForm('inquiry', {
    containerId: '#popup-inquiry',
    onSuccess: function (form) {
        $('#popup-inquiry .popup-default, #popup-inquiry .popup-thanks').toggle();
    },
});
```

### Popup with a differently-named form

```js
new WowPopup('promo', {
    form: {
        name: 'promo-signup',
        onSuccess: function (form, resp) {
            console.log('Form ' + form.name + ' submitted');
        },
    },
});
```

### Timed popup, once per session

Shows after 20 seconds, only once per browser session. Skipped if another popup is already visible.

```js
new WowPopup('general', {
    autoShow: {
        delay   : 20000,
        showOnce: true,
    },
});
```

### Timed popup, every page load

```js
new WowPopup('banner', {
    autoShow: {
        delay: 5000,
    },
});
```

### Immediate auto-show

```js
new WowPopup('welcome', {
    autoShow: true,
});
```

### Programmatic control

```js
// Show/hide by name
WowPopup.get('contact').show();
WowPopup.get('contact').hide();

// Reset a form
WowForm.get('newsletter').reset();

// Check scroll lock state
if (WowScrollLock.isLocked()) {
    console.log('A popup is open');
}

// Destroy instances
WowPopup.get('contact').destroy();
WowForm.get('newsletter').destroy();
```

---

## Expected HTML structure

```html
<!-- Popup -->
<div id="popup-{name}" class="popup" style="display: none;">
    <button class="popup-close">×</button>
    <div class="popup-content">
        <div class="popup-default">
            <form method="post" action="/endpoint">
                <div class="field-wrapper">
                    <input type="text" name="name" required>
                </div>
                <div class="field-wrapper">
                    <input type="email" name="email" required>
                </div>
                <div class="captcha"></div>
                <button type="submit">Submit</button>
            </form>
        </div>
        <div class="popup-thanks" style="display: none;">
            <p>Thank you!</p>
        </div>
    </div>
</div>

<!-- Toggle trigger -->
<button class="toggle-{name}-popup">Open</button>
```

### CSS classes used

| Class | Applied to | Description |
|---|---|---|
| `scrolllock-on` | `body` | Added when a popup is open |
| `focused` | `.field-wrapper` | Input inside is focused |
| `has-value` | `.field-wrapper` | Input has a non-empty value |
| `validation-error` | `.field-wrapper` | Input failed native validation |
| `captcha-rendered` | `form` | reCAPTCHA has been rendered on this form |
| `recaptcha-loaded` | `html` | reCAPTCHA script has loaded |