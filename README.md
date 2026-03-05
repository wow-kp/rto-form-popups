# rto-form-popups

Lightweight system for managing popups and forms — includes jQuery modules for scroll-locking, reCAPTCHA and AJAX submission, plus reusable Laravel Blade templates for rapid page builds.

## Table of Contents

- [Dependencies](#dependencies)
- [WowRecaptcha](#wowrecaptcha)
- [WowScrollLock](#wowscrolllock)
- [WowForm](#wowform)
- [WowPopup](#wowpopup)
- [template-form.blade.php](#template-formbladephp)
- [template-popup.blade.php](#template-popupbladephp)
- [JS Usage Examples](#js-usage-examples)
- [Expected HTML Structure](#expected-html-structure)

---

## Dependencies

- jQuery
- [Inputmask](https://github.com/RobinHerbots/Inputmask)
- Google reCAPTCHA v2 (invisible and/or checkbox) and/or v3 — loaded automatically

---

## Modules

### WowRecaptcha

Global reCAPTCHA loader and renderer. Supports **v2_invisible**, **v2_checkbox** ("I'm not a robot"), and **v3** captcha types. Lazily loads the reCAPTCHA script when a `form[method="post"]` enters the viewport using `IntersectionObserver`. Renders captcha on any such form that contains a `.captcha` element.

**Auto-initializes** from `<html data-sitekey="..." data-sitekey_cb="..." data-sitekey_v3="...">`. Manual init is also available.

#### HTML setup

Add sitekeys to the `<html>` tag. Values are pulled from `config/captcha.php`:

```blade
<html
  data-sitekey="{{ config('captcha.v2_invisible.sitekey') }}"
  data-sitekey_cb="{{ config('captcha.v2_checkbox.sitekey') }}"
  data-sitekey_v3="{{ config('captcha.v3.sitekey') }}"
>
```

| Attribute | Config key | Description |
|---|---|---|
| `data-sitekey` | `captcha.v2_invisible.sitekey` | Sitekey for invisible reCAPTCHA v2 |
| `data-sitekey_cb` | `captcha.v2_checkbox.sitekey` | Sitekey for checkbox reCAPTCHA v2 |
| `data-sitekey_v3` | `captcha.v3.sitekey` | Sitekey for reCAPTCHA v3 |

All three attributes are optional — only configure the types your site uses. Unused attributes have no effect.

> **Note:** Each reCAPTCHA type requires a separate sitekey registered in the [Google reCAPTCHA admin console](https://www.google.com/recaptcha/admin).

```js
// Manual init
WowRecaptcha.init({ v2_invisible: 'KEY_A', v2_checkbox: 'KEY_B', v3: 'KEY_C' });

// Legacy single-key init (treated as v2_invisible)
WowRecaptcha.init('KEY_A');
```

#### Script loading strategy

The reCAPTCHA script URL is determined at the moment it is first needed — not at init time. This means the decision is based on which forms are actually present on the page, not which keys happen to be configured globally on `<html>`.

| Forms on this page | v3 key configured | Script loaded | Covers |
|---|---|---|---|
| v2 only (any mix) | yes or no | `?render=explicit` | v2_invisible + v2_checkbox |
| any v3 form present | yes | `?render={v3_sitekey}` | v3 execute + v2 explicit widgets |
| any v3 form present | no | `?render=explicit` | v2_invisible + v2_checkbox (v3 silently skipped) |

Loading with `?render={v3_sitekey}` also exposes the full `grecaptcha.render()` / `grecaptcha.reset()` / `grecaptcha.getResponse()` surface for v2 widgets, so one script load covers all types when v3 is present. Pages with only v2 forms never load the v3 runtime.

#### Methods

| Method | Description |
|---|---|
| `init(keys)` | Set sitekeys and start observing forms. Accepts a string (v2_invisible only) or object `{ v2_invisible, v2_checkbox, v3 }` |
| `getSitekey(type)` | Returns the sitekey for the given type (`'v2_invisible'`, `'v2_checkbox'`, or `'v3'`). Falls back to `v2_invisible` then `v2_checkbox` |
| `isLoaded()` | Returns `true` if the reCAPTCHA script has loaded |
| `load(callback)` | Manually trigger script loading. Optional `callback` is queued and called once the script has loaded. Safe to call multiple times |
| `executeV3(action)` | Execute reCAPTCHA v3 and return a `Promise` that resolves with a one-time token. Triggers script load automatically if not already loaded. `action` defaults to `'submit'` |
| `renderForms()` | Render captcha on all unrendered `form[method="post"]` with `.captcha`. Reads `data-captcha-type` from each form. v3 forms are marked rendered immediately with no widget |
| `onLoad()` | Internal callback for the reCAPTCHA script — not called manually |

#### How forms are matched to captcha type

`renderForms()` reads the `data-captcha-type` attribute on each `<form>` to decide how to handle it. This attribute is set automatically by `WowForm` based on its `captcha` option — you don't need to add it manually.

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

Standalone form handler. Manages input masks, field states (focused/has-value), email validation, native validation error marking, reCAPTCHA execution and form submission (AJAX or native).

Supports **v2_invisible**, **v2_checkbox**, and **v3** reCAPTCHA via the `captcha` option.

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
| `ajax` | boolean | `true` | When `true`, submits via `$.ajax` and expects a JSON response. When `false`, performs a traditional full-page form submission |
| `captcha` | string | `'v2_invisible'` | reCAPTCHA type: `'v2_invisible'`, `'v2_checkbox'`, or `'v3'`. Determines which sitekey is used and how captcha validation is handled on submit |
| `beforePost` | function | `null` | **AJAX mode** — `function(form, data)`: receives serialized form data, return modified string. **Native mode** — `function(form, $form)`: receives the jQuery form element for DOM manipulation (e.g. appending hidden fields) before submit |
| `onSuccess` | function(form, resp) | `null` | Called when the server returns `resp.success === true`. AJAX mode only |
| `onError` | function(form, resp) | `null` | Called on `resp.success === false`, Laravel validation failure (422), or network error. On a 422, field errors are also applied as native HTML5 validation messages before this callback fires. `resp` is `null` on network failure. AJAX mode only |

#### Captcha behaviour by type

| Type | Widget rendered | Submit button | On submit |
|---|---|---|---|
| `'v2_invisible'` | Hidden widget in `.captcha` | Enabled after render | `grecaptcha.execute()` called automatically if no token; submits after resolution |
| `'v2_checkbox'` | "I'm not a robot" checkbox in `.captcha` | Enabled after render | Blocked if unchecked, `.captcha-error` applied; submits immediately once checked |
| `'v3'` | None | Enabled immediately (no render needed) | `grecaptcha.execute()` called on submit; token injected as `g-recaptcha-response-v3` hidden field |

#### Methods

| Method | Description |
|---|---|
| `WowForm.get(name)` | Static. Returns the WowForm instance by name, or `null` |
| `set(key, value)` | Update a single option at runtime. Returns `this` for chaining. See Set behaviour below |
| `reset()` | Reset the form, field states, server validation messages, captcha error highlight, captcha widget, and any injected v3 token field |
| `destroy()` | Unbind all events and remove from registry |

#### `set()` behaviour

| Key | What happens |
|---|---|
| `containerId` | Destroys old event bindings, updates container, reinitializes on new container |
| `captcha` | Resets any existing v2 widget (skipped when switching away from v3), updates `data-captcha-type`, clears the `.captcha` container, removes any injected `g-recaptcha-response-v3` field. Enables submit immediately for v3; for v2 types re-renders the widget if the script is loaded |
| `ajax` | Stores the value — read at runtime in `_submit()`, no reinit needed |
| `beforePost` | Stores the value — read at runtime, no reinit needed |
| `onSuccess` | Stores the value — read at runtime in `_post()`, no reinit needed |
| `onError` | Stores the value — read at runtime in `_post()`, no reinit needed |

```js
// v2_invisible captcha (default)
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        alert('Thanks for subscribing!');
    },
});

// v2_checkbox captcha
new WowForm('feedback', {
    containerId: '#feedback-form',
    captcha: 'v2_checkbox',
    onSuccess: function (form, resp) {
        alert('Feedback received!');
    },
});

// v3 captcha
new WowForm('contact', {
    containerId: '#contact-form',
    captcha: 'v3',
    onSuccess: function (form, resp) {
        alert('Message sent!');
    },
});

// Switch captcha type at runtime
WowForm.get('newsletter').set('captcha', 'v2_checkbox');
WowForm.get('newsletter').set('captcha', 'v3');

// Chain multiple updates
WowForm.get('newsletter')
    .set('captcha', 'v2_checkbox')
    .set('onSuccess', function (form, resp) { alert('Done!'); })
    .set('onError', function (form, resp) { alert('Failed'); })
    .set('beforePost', function (form, data) { return data + '&source=footer'; });

// Move form to a different container
WowForm.get('newsletter').set('containerId', '#new-container');

// Switch to native submission at runtime
WowForm.get('newsletter').set('ajax', false);
```

#### Submission modes

**AJAX mode** (`ajax: true`, default)

The form is submitted via `$.ajax` with an `Accept: application/json` header. The server must return JSON. A successful response must include `{ "success": true }`. Any other response triggers the error flow. `onSuccess` and `onError` callbacks are called accordingly.

Laravel's `$request->validate()` is supported out of the box — on validation failure, Laravel returns a 422 with `{ "errors": { "field": ["message", ...] } }`. WowForm automatically stamps each field with its first error message using the native HTML5 constraint validation API (matching browser-native tooltip behaviour), then calls `onError` with the full response.

**Native mode** (`ajax: false`)

The form performs a traditional full-page submission via `HTMLFormElement.submit()`. The browser navigates to the action URL and the server handles the response (redirect, rendered page, etc.). `onSuccess` and `onError` are not called since the page navigates away.

The `beforePost` callback in native mode receives the jQuery `$form` object instead of serialized data. Use it to append hidden fields or modify the form DOM before submission:

```js
new WowForm('apply', {
    ajax: false,
    beforePost: function (form, $form) {
        $form.append('<input type="hidden" name="ref" value="banner">');
    },
});
```

> **Note:** `HTMLFormElement.submit()` does not re-fire the `submit` event, so there is no risk of an infinite loop. It also skips HTML5 constraint validation, but this is safe because validation already ran when the original event fired.

#### Example

```js
// AJAX form with v2_invisible captcha (default)
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        $('#newsletter-signup').html('<p>Thanks!</p>');
    },
});

// AJAX form with v2_checkbox captcha
new WowForm('contact', {
    containerId: '#contact-form',
    captcha: 'v2_checkbox',
    onSuccess: function (form, resp) {
        $('#contact-form').html('<p>Message sent!</p>');
    },
});

// AJAX form with v3 captcha
new WowForm('contact', {
    containerId: '#contact-form',
    captcha: 'v3',
    onSuccess: function (form, resp) {
        $('#contact-form').html('<p>Message sent!</p>');
    },
});

// Native form
new WowForm('apply', {
    containerId: '#apply-form',
    ajax: false,
    beforePost: function (form, $form) {
        $form.append('<input type="hidden" name="timezone" value="' + Intl.DateTimeFormat().resolvedOptions().timeZone + '">');
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
| `captcha` | string | `'v2_invisible'` | reCAPTCHA type: `'v2_invisible'`, `'v2_checkbox'`, or `'v3'` |
| `beforePost` | function | `null` | Modify data before submission. Signature depends on `ajax` mode (see WowForm) |
| `onSuccess` | function(form, resp) | Toggles `.popup-default` / `.popup-thanks` | Called on `resp.success === true`. AJAX mode only |
| `onError` | function(form, resp) | `null` | Called on failure or Laravel 422 validation error. AJAX mode only |

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
| `set(key, value)` | Update a single option at runtime. Returns `this` for chaining. See Set behaviour below |
| `destroy()` | Hide, unbind all events and remove from registry |

#### `set()` behaviour

| Key | What happens |
|---|---|
| `form` | Destroys old WowForm instance, creates new one with updated options. Pass `null` to remove the form |
| `toggleClasses` | Unbinds old click handlers, rebinds with new selectors. `.toggle-{name}-popup` is always preserved |
| `autoShow` | Triggers the auto-show timer with the new configuration |
| `onShow` | Stores the value — read at runtime on show, no reinit needed |
| `onHide` | Stores the value — read at runtime on hide, no reinit needed |
| `resetOnHide` | Stores the value — read at runtime on hide, no reinit needed |
| `popupId` | Stores the value — no reinit needed |

```js
// Update form config (destroys old WowForm, creates new one)
WowPopup.get('march').set('form', {
    captcha: 'v2_checkbox',
    onSuccess: function (form, resp) { alert('Sent!'); },
    onError: function (form, resp) { alert('Failed'); },
});

// Remove form
WowPopup.get('march').set('form', null);

// Change toggle triggers
WowPopup.get('march').set('toggleClasses', '.new-trigger, .another-trigger');

// Update callbacks
WowPopup.get('march').set('onShow', function (popup) { console.log('opened'); });

// Chain multiple updates
WowPopup.get('march')
    .set('form', { captcha: 'v2_checkbox', onSuccess: fn })
    .set('toggleClasses', '.cta-btn')
    .set('resetOnHide', false)
    .set('onShow', function () { console.log('hi'); });
```

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
| `form_id` | string | **Yes** | — | Unique form identifier. Used for `WowForm` initialization when not inside a popup |
| `smart_id` | string | No | `''` | Smart ID for tracking (hidden field) |
| `in_popup` | bool | No | `false` | Set to `true` when the form is inside a `WowPopup` — skips standalone `WowForm` init |
| `ajax` | bool | No | `true` | When `false`, initializes `WowForm` with `ajax: false` for native full-page submission. Only applies when `in_popup` is falsy (popup forms are configured via `WowPopup`) |
| `captcha` | string | No | `'v2_invisible'` | reCAPTCHA type: `'v2_invisible'`, `'v2_checkbox'`, or `'v3'`. Passed directly to `<x-inputs.captcha-type>` and to `WowForm` — no translation applied. Only applies when `in_popup` is falsy (popup forms are configured via `WowPopup`) |
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
| `attributes` | array | `[]` | Extra HTML attributes as `['key' => 'value', ...]`. Only whitelisted keys are rendered — unknown keys are silently dropped. Boolean attributes (e.g. `disabled`) should use an empty string value: `['disabled' => '']`. |

#### `attributes` whitelist

Only the following keys are accepted. Any key not in this list is ignored:

| Key | Example use |
|---|---|
| `disabled` | `['disabled' => '']` |
| `readonly` | `['readonly' => '']` |
| `placeholder` | `['placeholder' => 'e.g. John']` |
| `autocomplete` | `['autocomplete' => 'given-name']` |
| `maxlength` | `['maxlength' => '100']` |
| `min` | `['min' => '0']` |
| `max` | `['max' => '9999']` |
| `step` | `['step' => '0.01']` |
| `class` | `['class' => 'extra-class']` |
| `data-*` | Any `data-` prefixed key is allowed: `['data-foo' => 'bar']`, etc. |

> **Note:** `attributes` must always be an array. Passing a plain string is no longer supported and will render nothing.

### Built-in behaviour

- `_token` (CSRF), `source`, `smart_id`, and captcha-type hidden fields are always rendered
- The `captcha` value is passed directly to `<x-inputs.captcha-type type="{{ $captcha }}">` with no mapping — the component receives `v2_invisible`, `v2_checkbox`, or `v3` as-is
- For `v3`, no `.captcha` div is rendered and the submit button is not disabled (no widget render step)
- `tel` fields automatically get the mask `(999) 999-9999` and matching pattern
- The `store` select always populates from the `$stores` Eloquent collection (`$store->id`, `$store->name`)
- All other selects use the `options` array from the field definition
- Every select starts with an empty disabled/hidden placeholder option
- When `in_popup` is falsy (default), a `WowForm` instance is automatically initialized via `@push('scripts')` using `form_id`. The `captcha` value is forwarded unless it is the default `v2_invisible`, in which case it is omitted and WowForm's own default applies
- When `in_popup` is `true`, the script is skipped — `WowPopup` handles form creation internally

### Usage examples

#### All defaults

```blade
@include('partials.template-form', [
    'source'  => 'contact-page',
    'form_id' => 'contact',
])
```

#### With smart_id

```blade
@include('partials.template-form', [
    'source'   => 'contact-page',
    'form_id'  => 'contact',
    'smart_id' => $smart_id,
])
```

#### Exclude fields

```blade
@include('partials.template-form', [
    'source'          => 'contact-page',
    'form_id'         => 'contact',
    'excluded_fields' => ['phone', 'store'],
])
```

#### Custom submit button

```blade
@include('partials.template-form', [
    'source'       => 'request-page',
    'form_id'      => 'request',
    'submit_text'  => 'Send Request',
    'submit_class' => 'bg-red white',
])
```

#### Extra hidden fields

```blade
@include('partials.template-form', [
    'source'        => 'promo-page',
    'form_id'       => 'promo',
    'hidden_fields' => ['campaign' => 'summer-sale', 'ref' => 'banner'],
])
```

#### Custom action

```blade
@include('partials.template-form', [
    'source'  => 'inquiry-page',
    'form_id' => 'inquiry',
    'action'  => '/custom-endpoint',
])
```

#### Fully custom rows

```blade
@include('partials.template-form', [
    'source'  => 'quote-page',
    'form_id' => 'quote',
    'rows'    => [
        [
            ['name' => 'company',  'label' => 'Company Name', 'required' => true],
            ['name' => 'website',  'label' => 'Website'],
        ],
        [
            ['name' => 'email', 'type' => 'email', 'label' => 'Work Email', 'required' => true],
            ['name' => 'phone', 'type' => 'tel',   'label' => 'Phone',      'required' => true],
        ],
        [
            ['name' => 'budget', 'type' => 'select', 'label' => 'Budget Range', 'required' => true,
             'options' => ['small' => 'Under $5k', 'medium' => '$5k–$20k', 'large' => '$20k+']],
        ],
        [
            ['name' => 'message', 'label' => 'Project Details'],
        ],
    ],
    'submit_text'  => 'Request Quote',
    'submit_class' => 'bg-red white',
])
```

#### Custom select in custom rows

```blade
@include('partials.template-form', [
    'source'  => 'feedback-page',
    'form_id' => 'feedback',
    'rows'    => [
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
    'form_id'         => 'sidebar',
    'tabindex_start'  => 80,
    'excluded_fields' => ['message', 'store'],
    'submit_text'     => 'Get Started',
])
```

#### Inside a popup (skip WowForm init)

```blade
@include('partials.template-form', [
    'source'   => 'promo-page',
    'form_id'  => 'promo',
    'in_popup' => true,
])
```

#### Native form submission (no AJAX)

```blade
@include('partials.template-form', [
    'source'  => 'apply-page',
    'form_id' => 'apply',
    'ajax'    => false,
])
```

#### v2_checkbox captcha

```blade
@include('partials.template-form', [
    'source'  => 'feedback-page',
    'form_id' => 'feedback',
    'captcha' => 'v2_checkbox',
])
```

#### v3 captcha

```blade
@include('partials.template-form', [
    'source'  => 'contact-page',
    'form_id' => 'contact',
    'captcha' => 'v3',
])
```

#### v2_checkbox captcha with native submission

```blade
@include('partials.template-form', [
    'source'  => 'apply-page',
    'form_id' => 'apply',
    'ajax'    => false,
    'captcha' => 'v2_checkbox',
])
```

---

## template-popup.blade.php

Reusable Blade component for rendering popups with optional forms. Generates the popup HTML structure and initializes `WowPopup` via JS. Supports per-page customisation using `set()` in a separate script block.

Include with `@include` for simple usage or `@component` when you need to inject HTML via slots.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | **Yes** | — | Unique popup identifier. Used for `#popup-{name}`, `WowPopup` instance name, and the JS variable `popup_{name}` |
| `i` | string | No | `''` | Image root path, available as `data-imgroot` on the popup element |
| `form` | bool / array | No | `false` | When `true`, renders `template-form` with `source` and `form_id` defaulting to `$name`. When an array, passes those values as [template-form parameters](#template-formbladephp) (merged with defaults). `in_popup` is always set to `true`. The `captcha` value, when present, is forwarded to the JS `WowPopup` initialization |

### Slots

| Slot | Description |
|---|---|
| `$styles` | Custom styles. Rendered before the popup HTML |
| `$close_img` | Custom close button image/content. Defaults to `×` |
| `$form_text` | Content above the form (only when `$form` is set) |
| `$popup_default` | Content inside `.popup-default`. When `$form` is set, rendered **below** the form. When `$form` is not set, this is the sole content |
| `$popup_steps` | Additional popup steps/screens (e.g. scratch game, multi-step flow) |
| `$popup_thanks` | Thank-you content inside `.popup-thanks`. Defaults to "Thank you!" |
| `$scripts` | Custom scripts. Rendered after the popup initialization script |

### File location

```
resources/views/frontend/{theme_name}/components/template-popup.blade.php
```

### Usage examples

#### Minimal popup with form (all defaults)

```blade
@component(theme('components.template-popup'), ['name' => 'simple', 'form' => true])

    @slot('form_text')
        <h2>Contact Us</h2>
        <p>Fill out the form and we'll get back to you.</p>
    @endslot

    @slot('popup_thanks')
        <h3>Thank you!</h3>
        <p>We'll be in touch soon.</p>
    @endslot

@endcomponent
```

#### Popup with custom form options

```blade
@component(theme('components.template-popup'), [
    'name' => 'quote',
    'form' => [
        'source'          => 'quote-page',
        'excluded_fields' => ['store', 'message'],
        'submit_text'     => 'Get My Quote',
        'submit_class'    => 'bg-red white',
        'hidden_fields'   => ['campaign' => 'summer-sale'],
    ],
])

    @slot('form_text')
        <h2>Request a Quote</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Quote Requested!</h3>
        <p>Check your email for details.</p>
    @endslot

@endcomponent
```

#### Popup with v3 captcha

```blade
@component(theme('components.template-popup'), [
    'name' => 'contact',
    'form' => [
        'source'          => 'contact-popup',
        'excluded_fields' => ['store', 'message'],
        'captcha'         => 'v3',
        'submit_text'     => 'Send Message',
    ],
])

    @slot('form_text')
        <h2>Get in Touch</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Message sent!</h3>
        <p>We'll be in touch shortly.</p>
    @endslot

@endcomponent
```

#### Popup with custom callbacks via set()

```blade
@component(theme('components.template-popup'), [
    'name' => 'march',
    'form' => [
        'source'          => 'march-promo',
        'smart_id'        => $smart_id ?? '',
        'excluded_fields' => ['message'],
        'submit_text'     => 'Get Coupon',
    ],
])

    @slot('form_text')
        <h2>March Madness Sale!</h2>
        <p>Fill out the form for an exclusive coupon.</p>
    @endslot

    @slot('popup_thanks')
        <h3>You're in!</h3>
        <p>Check your email for your coupon code.</p>
    @endslot

    @slot('scripts')
        <script>
        jQuery(document).ready(function($){
            popup_march.set('form', {
                beforePost: function(form, data) {
                    return data + '&campaign=march-madness';
                },
                onSuccess: function(form, resp) {
                    $('#popup-march .popup-default, #popup-march .popup-thanks').toggle();
                },
                onError: function(form, resp) {
                    alert('Something went wrong. Please try again.');
                }
            });
        });
        </script>
    @endslot

@endcomponent
```

#### Popup without a form (gallery / info)

```blade
@component(theme('components.template-popup'), ['name' => 'gallery'])

    @slot('popup_default')
        <h2>Product Gallery</h2>
        <div class="gallery-grid">
            <img src="/images/product-1.jpg" alt="Product 1">
            <img src="/images/product-2.jpg" alt="Product 2">
            <img src="/images/product-3.jpg" alt="Product 3">
        </div>
    @endslot

@endcomponent
```

#### Popup with form and content below it

```blade
@component(theme('components.template-popup'), [
    'name' => 'terms',
    'form' => [
        'source'          => 'terms-popup',
        'excluded_fields' => ['store', 'message'],
        'submit_text'     => 'Send Request',
    ],
])

    @slot('form_text')
        <h2>Get More Information</h2>
        <p>Fill out the form and we'll be in touch.</p>
    @endslot

    @slot('popup_default')
        <p class="text-center f-dark-gray mt2">
            By submitting this form you agree to our
            <a href="/privacy-policy">Privacy Policy</a>.
        </p>
    @endslot

    @slot('popup_thanks')
        <h3>Request received!</h3>
        <p>We'll be in touch shortly.</p>
    @endslot

@endcomponent
```

#### With image root and custom styles

```blade
@component(theme('components.template-popup'), [
    'name' => 'august',
    'i'    => '/themes/rent2own/promos/25/aug/images',
    'form' => [
        'source'          => 'august-promo',
        'excluded_fields' => ['store', 'message'],
        'submit_text'     => 'Get Coupon',
    ],
])

    @slot('styles')
        <link rel="stylesheet" href="/themes/{{ $account->theme }}/promos/25/aug/css/popup.css">
    @endslot

    @slot('close_img')
        <img src="/themes/rent2own/images/close-white.svg" alt="Close">
    @endslot

    @slot('form_text')
        <h2>August Sale!</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Check your email!</h3>
        <p>Your coupon is on the way.</p>
    @endslot

@endcomponent
```

#### Using `@include` (no slots needed)

```blade
@include(theme('components.template-popup'), [
    'name' => 'simple',
    'form' => true,
])
```

When using `@include`, the popup renders with empty default/thanks content. Use `set()` to customize the form behaviour.

#### Customizing with `set()` via the scripts slot

```blade
@component(theme('components.template-popup'), [
    'name' => 'march',
    'form' => ['source' => 'march-promo'],
])

    @slot('form_text')
        <h2>March Promo</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Thanks!</h3>
    @endslot

    @slot('scripts')
        <script>
        jQuery(document).ready(function($){
            popup_march.set('form', {
                beforePost: function(form, data) {
                    return data + '&campaign=march';
                },
                onSuccess: function(form, resp) {
                    $('#popup-march .popup-default, #popup-march .popup-thanks').toggle();
                },
                onError: function(form, resp) {
                    alert('Something went wrong.');
                }
            });
        });
        </script>
    @endslot

@endcomponent
```

#### Chaining multiple `set()` calls

```blade
@slot('scripts')
    <script>
    jQuery(document).ready(function($){
        popup_march
            .set('form', {
                captcha: 'v2_checkbox',
                beforePost: function(form, data) {
                    return data + '&campaign=march';
                },
                onSuccess: function(form, resp) {
                    $('#popup-march .popup-default, #popup-march .popup-thanks').toggle();
                },
                onError: function(form, resp) {
                    alert('Something went wrong.');
                }
            })
            .set('toggleClasses', '.hero-cta, .sidebar-cta')
            .set('resetOnHide', false)
            .set('onShow', function(popup) {
                console.log('Popup opened');
            })
            .set('onHide', function(popup) {
                console.log('Popup closed');
            });
    });
    </script>
@endslot
```

#### Adding auto-show via `set()`

```blade
@slot('scripts')
    <script>
    jQuery(document).ready(function($){
        popup_march.set('autoShow', {
            delay: 20000,
            showOnce: true
        });
    });
    </script>
@endslot
```

#### Updating form callbacks independently via `WowForm.get()`

```blade
@slot('scripts')
    <script>
    jQuery(document).ready(function($){
        WowForm.get('march')
            .set('onSuccess', function(form, resp) {
                alert('Custom success!');
            })
            .set('onError', function(form, resp) {
                alert('Custom error!');
            })
            .set('beforePost', function(form, data) {
                return data + '&ref=banner';
            });
    });
    </script>
@endslot
```

#### Switching captcha type via `WowForm.get()`

```blade
@slot('scripts')
    <script>
    jQuery(document).ready(function($){
        WowForm.get('march').set('captcha', 'v2_checkbox');
    });
    </script>
@endslot
```

#### Removing the form via `set()`

```blade
@slot('scripts')
    <script>
    jQuery(document).ready(function($){
        popup_march.set('form', null);
    });
    </script>
@endslot
```

#### Popup with scratch-card game

```blade
@component(theme('components.template-popup'), [
    'name' => 'scratch',
    'i'    => $i . '/scratch',
    'form' => [
        'source'          => 'scratch-game',
        'excluded_fields' => ['message', 'store'],
        'submit_text'     => 'Play Now',
    ],
])

    @slot('form_text')
        <h2>Scratch & Score!</h2>
        <p>Enter your info for a chance to win.</p>
    @endslot

    @slot('popup_steps')
        <div class="popup-game" style="display: none;">
            <div class="scratchpad"></div>
        </div>
    @endslot

    @slot('popup_thanks')
        <h3>Congratulations!</h3>
        <p>Show this screen in store to redeem your prize.</p>
    @endslot

    @slot('scripts')
        <script>
        jQuery(document).ready(function($){
            popup_scratch.set('form', {
                onSuccess: function(wp, resp) {
                    var imgroot = $('#popup-scratch').data('imgroot');
                    $('#popup-scratch .popup-default, #popup-scratch .popup-game').toggle();
                    $('#popup-scratch .scratchpad').wScratchPad({
                        size: 20,
                        bg: imgroot + '/bg.png',
                        fg: imgroot + '/fg.png',
                        realtime: true,
                        scratchMove: function(e, percent) {
                            if (percent >= 75) {
                                $('#popup-scratch .popup-game').addClass('events-none').hide();
                                $('#popup-scratch .popup-thanks').show();
                                this.clear();
                                this.reset();
                                this.enabled = false;
                                this.scratch = false;
                            }
                        },
                        cursor: 'url("' + imgroot + '/coin.png") 70 68, default'
                    });
                }
            });
        });
        </script>
    @endslot

@endcomponent
```

#### Popup with fully custom form rows

```blade
@component(theme('components.template-popup'), [
    'name' => 'feedback',
    'form' => [
        'source' => 'feedback-form',
        'action' => '/submitFeedback',
        'rows'   => [
            [
                ['name' => 'first_name', 'label' => 'First Name', 'required' => true],
                ['name' => 'last_name',  'label' => 'Last Name',  'required' => true],
            ],
            [
                ['name' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true],
            ],
            [
                ['name' => 'department', 'type' => 'select', 'label' => 'Department', 'required' => true,
                 'options' => ['sales' => 'Sales', 'support' => 'Support', 'other' => 'Other']],
            ],
            [
                ['name' => 'message', 'label' => 'Your Feedback', 'required' => true],
            ],
        ],
        'submit_text' => 'Send Feedback',
    ],
])

    @slot('form_text')
        <h2>We'd love your feedback</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Feedback received!</h3>
        <p>We appreciate you taking the time.</p>
    @endslot

@endcomponent
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

### Standalone form with v2_checkbox captcha

```js
new WowForm('feedback', {
    containerId: '#feedback-form',
    captcha: 'v2_checkbox',
    onSuccess: function (form, resp) {
        $('#feedback-form').html('<p>Thanks for your feedback!</p>');
    },
});
```

### Standalone form with v3 captcha

```js
new WowForm('contact', {
    containerId: '#contact-form',
    captcha: 'v3',
    onSuccess: function (form, resp) {
        $('#contact-form').html('<p>Message sent!</p>');
    },
});
```

### Standalone native form (no AJAX)

```js
new WowForm('apply', {
    containerId: '#apply-form',
    ajax: false,
    beforePost: function (form, $form) {
        $form.append('<input type="hidden" name="ref" value="landing-page">');
    },
});
```

### Switch an existing form to native submission

```js
WowForm.get('contact').set('ajax', false);
```

### Switch captcha type at runtime

```js
WowForm.get('contact').set('captcha', 'v2_checkbox');
WowForm.get('contact').set('captcha', 'v3');
WowForm.get('contact').set('captcha', 'v2_invisible');
```

### Popup without a form

```js
new WowPopup('gallery');
```

### Popup with a form (all defaults)

```js
new WowPopup('request', { form: true });
```

### Popup with v3 captcha

```js
new WowPopup('contact', {
    form: {
        captcha: 'v3',
        onSuccess: function (form, resp) {
            alert('Message sent!');
        },
    },
});
```

### Popup with v2_checkbox captcha

```js
new WowPopup('contact', {
    form: {
        captcha: 'v2_checkbox',
        onSuccess: function (form, resp) {
            alert('Message sent!');
        },
    },
});
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

### Popup with native form submission

```js
new WowPopup('external', {
    form: {
        ajax: false,
        beforePost: function (form, $form) {
            $form.append('<input type="hidden" name="source" value="popup">');
        },
    },
});
```

### Initialize then customize with `set()`

```js
var popup_march = new WowPopup('march', { form: true });

popup_march.set('form', {
    captcha: 'v2_checkbox',
    beforePost: function (form, data) {
        return data + '&source=website';
    },
    onSuccess: function (form, resp) {
        alert('Message sent!');
    },
    onError: function (form, resp) {
        alert('Failed to send, please try again.');
    },
});
```

### Update form callbacks on the fly

```js
WowForm.get('contact')
    .set('onSuccess', function (form, resp) {
        alert('New success handler!');
    })
    .set('onError', function (form, resp) {
        alert('New error handler!');
    });
```

### Multiple toggle triggers

```js
new WowPopup('signup', {
    toggleClasses: '.hero-cta, .sidebar-cta, #exit-intent-trigger',
    form: true,
});

// Change triggers later
WowPopup.get('signup').set('toggleClasses', '.new-cta, .promo-banner');
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
        captcha: 'v2_checkbox',
        onSuccess: function (form, resp) {
            console.log('Form ' + form.name + ' submitted');
        },
    },
});
```

### Timed popup, once per session

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

// Update options at runtime
WowPopup.get('contact').set('onShow', function () { console.log('opened'); });
WowForm.get('newsletter').set('onSuccess', function () { alert('done'); });

// Switch captcha type at runtime
WowForm.get('newsletter').set('captcha', 'v2_checkbox');
WowForm.get('newsletter').set('captcha', 'v3');

// Switch submission mode at runtime
WowForm.get('newsletter').set('ajax', false);

// Destroy instances
WowPopup.get('contact').destroy();
WowForm.get('newsletter').destroy();
```

---

## Expected HTML Structure

### Popup

```html
<div id="popup-{name}" class="popup" style="display: none;">
    <div class="popup-overlay"></div>
    <div class="popup-content">
        <button class="popup-close toggle-{name}-popup">Close popup</button>
        <div class="popup-default">
            <!-- Form or custom content here -->
        </div>
        <div class="popup-thanks" style="display: none;">
            <p>Thank you!</p>
        </div>
    </div>
</div>

<!-- Toggle trigger -->
<button class="toggle-{name}-popup">Open</button>
```

### Form (v2_invisible / v2_checkbox)

```html
<form method="post" action="/submitLead" class="uni-style" data-captcha-type="v2_invisible">

    <input type="hidden" name="_token" value="...">
    <input type="hidden" name="source" value="{source}">
    <input type="hidden" name="smart_id" value="{smart_id}">
    <input type="hidden" name="captcha_type" value="v2_invisible">

    <div class="form-row flex">
        <!-- Text input -->
        <div class="form-field">
            <div class="field-wrapper relative flex items-center">
                <label for="first_name" class="absolute z1 events-none">First Name</label>
                <input type="text" name="first_name" id="first_name"
                       class="border border-gray avenir-medium mx-auto"
                       tabindex="41" required>
            </div>
        </div>

        <!-- Select input -->
        <div class="form-field">
            <div class="field-wrapper relative flex items-center select_box">
                <label for="store" class="absolute z1 events-none">Select a Store</label>
                <select name="store" id="store"
                        class="border border-gray avenir-medium mx-auto no-app not-selectric not-select"
                        tabindex="42" required>
                    <option value="" disabled hidden selected></option>
                    <option value="1">Store One</option>
                </select>
            </div>
        </div>
    </div>

    <div class="form-action">
        <div class="captcha"></div>
        <button type="submit" class="button" disabled>Submit</button>
    </div>

</form>
```

### Form (v3)

```html
<form method="post" action="/submitLead" class="uni-style" data-captcha-type="v3">

    <input type="hidden" name="_token" value="...">
    <input type="hidden" name="source" value="{source}">
    <input type="hidden" name="smart_id" value="{smart_id}">
    <input type="hidden" name="captcha_type" value="v3">

    <div class="form-row flex">
        <!-- fields -->
    </div>

    <div class="form-action">
        <!-- no .captcha div for v3 -->
        <button type="submit" class="button">Submit</button>
        <!-- g-recaptcha-response-v3 injected here by JS on submit -->
    </div>

</form>
```

### CSS classes used

| Class | Applied to | Description |
|---|---|---|
| `scrolllock-on` | `body` | Added when a popup is open |
| `focused` | `.field-wrapper` | Input inside is focused |
| `has-value` | `.field-wrapper` | Input has a non-empty value |
| `validation-error` | `.field-wrapper` | Input failed native or server-side validation |
| `captcha-error` | `.captcha` | v2_checkbox captcha was not checked before submit |
| `captcha-rendered` | `form` | reCAPTCHA has been rendered on this form (also set immediately for v3 forms, where no widget is rendered) |
| `recaptcha-loaded` | `html` | reCAPTCHA script has loaded |