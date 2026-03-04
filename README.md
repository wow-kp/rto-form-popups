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
- Google reCAPTCHA v2 (invisible and/or checkbox) — loaded automatically

---

## Modules

### WowRecaptcha

Global reCAPTCHA loader and renderer. Supports both **invisible** and **checkbox** ("I'm not a robot") captcha types. Lazily loads the reCAPTCHA script when a `form[method="post"]` enters the viewport using `IntersectionObserver`. Renders captcha on any such form that contains a `.captcha` element.

**Auto-initializes** from `<html data-sitekey="..." data-sitekey_cb="...">`. Manual init is also available.

#### HTML setup

Add both sitekeys to the `<html>` tag. Values are pulled from `config/captcha.php`:

```blade
<html data-sitekey="{{config('captcha.v2_invisible.sitekey')}}" data-sitekey_cb="{{config('captcha.v2_checkbox.sitekey')}}">
```

| Attribute | Config key | Description |
|---|---|---|
| `data-sitekey` | `captcha.v2_invisible.sitekey` | Sitekey for invisible reCAPTCHA v2 |
| `data-sitekey_cb` | `captcha.v2_checkbox.sitekey` | Sitekey for checkbox reCAPTCHA v2 |

> **Note:** Invisible and checkbox reCAPTCHA require separate sitekeys registered in the [Google reCAPTCHA admin console](https://www.google.com/recaptcha/admin). Each sitekey is tied to a specific type.

```js
// Manual init (optional if data attributes are set)
WowRecaptcha.init({ invisible: 'KEY_A', checkbox: 'KEY_B' });

// Legacy single-key init (treated as invisible)
WowRecaptcha.init('KEY_A');
```

#### Methods

| Method | Description |
|---|---|
| `init(keys)` | Set sitekeys and start observing forms. Accepts a string (invisible only) or object `{ invisible, checkbox }` |
| `getSitekey(type)` | Returns the sitekey for the given type (`'invisible'` or `'checkbox'`). Falls back to whichever key is available |
| `isLoaded()` | Returns `true` if the reCAPTCHA script has loaded |
| `load()` | Manually trigger script loading (called automatically by WowPopup on show) |
| `renderForms()` | Render captcha on all unrendered `form[method="post"]` with `.captcha`. Reads `data-captcha-type` from each form to determine which type to render |
| `onLoad()` | Internal callback for the reCAPTCHA script — not called manually |

#### How forms are matched to captcha type

`renderForms()` reads the `data-captcha-type` attribute on each `<form>` to decide which sitekey and mode to use. This attribute is set automatically by `WowForm` based on its `captcha` option — you don't need to add it manually.

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

Supports both **invisible** and **checkbox** reCAPTCHA via the `captcha` option.

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
| `captcha` | string | `'invisible'` | reCAPTCHA type: `'invisible'` or `'checkbox'`. Determines which sitekey is used and how captcha validation is handled on submit |
| `beforePost` | function | `null` | **AJAX mode** — `function(form, data)`: receives serialized form data, return modified string. **Native mode** — `function(form, $form)`: receives the jQuery form element for DOM manipulation (e.g. appending hidden fields) before submit |
| `onSuccess` | function(form, resp) | `null` | Called when the server returns `resp.success === true`. AJAX mode only |
| `onError` | function(form, resp) | `null` | Called on `resp.success === false`, Laravel validation failure (422), or network error. On a 422, field errors are also applied as native HTML5 validation messages before this callback fires. `resp` is `null` on network failure. AJAX mode only |

#### Captcha behaviour by type

| Type | Submit without token | Submit with token |
|---|---|---|
| `'invisible'` | `grecaptcha.execute()` is called automatically, form submits after resolution | Submits immediately |
| `'checkbox'` | Submission is blocked, `.captcha-error` class is added to the `.captcha` element to highlight the checkbox | Submits immediately |

#### Methods

| Method | Description |
|---|---|
| `WowForm.get(name)` | Static. Returns the WowForm instance by name, or `null` |
| `set(key, value)` | Update a single option at runtime. Returns `this` for chaining. See Set behaviour below |
| `reset()` | Reset the form, field states, server validation messages, captcha error highlight and captcha widget |
| `destroy()` | Unbind all events and remove from registry |

#### `set()` behaviour

| Key | What happens |
|---|---|
| `containerId` | Destroys old event bindings, updates container, reinitializes on new container |
| `captcha` | Resets the current captcha widget, updates the form's `data-captcha-type`, clears the `.captcha` container, and re-renders with the new type if reCAPTCHA is loaded |
| `ajax` | Stores the value — read at runtime in `_submit()`, no reinit needed |
| `beforePost` | Stores the value — read at runtime, no reinit needed |
| `onSuccess` | Stores the value — read at runtime in `_post()`, no reinit needed |
| `onError` | Stores the value — read at runtime in `_post()`, no reinit needed |

```js
// Invisible captcha (default)
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        alert('Thanks for subscribing!');
    },
});

// Checkbox captcha
new WowForm('feedback', {
    containerId: '#feedback-form',
    captcha: 'checkbox',
    onSuccess: function (form, resp) {
        alert('Feedback received!');
    },
});

// Switch captcha type at runtime
WowForm.get('newsletter').set('captcha', 'checkbox');

// Chain multiple updates
WowForm.get('newsletter')
    .set('captcha', 'checkbox')
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
// AJAX form with invisible captcha (default)
new WowForm('newsletter', {
    containerId: '#newsletter-signup',
    onSuccess: function (form, resp) {
        $('#newsletter-signup').html('<p>Thanks!</p>');
    },
});

// AJAX form with checkbox captcha
new WowForm('contact', {
    containerId: '#contact-form',
    captcha: 'checkbox',
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
| `captcha` | string | `'invisible'` | reCAPTCHA type: `'invisible'` or `'checkbox'` |
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
| `resetPopup()` | Reset popup view state and associated form |
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
    captcha: 'checkbox',
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
    .set('form', { captcha: 'checkbox', onSuccess: fn })
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
| `captcha` | string | No | `'invisible'` | reCAPTCHA type: `'invisible'` or `'checkbox'`. Controls which `<x-inputs.captcha-type>` hidden field is rendered and which captcha type is passed to `WowForm`. Only applies when `in_popup` is falsy (popup forms are configured via `WowPopup`) |
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

- `_token` (CSRF), `source`, `smart_id`, and captcha-type hidden fields are always rendered
- The captcha-type hidden field is rendered via `<x-inputs.captcha-type>` — outputs `type="v2_checkbox"` when `captcha` is `'checkbox'`, otherwise `type="v2_invisible"`
- `tel` fields automatically get the mask `(999) 999-9999` and matching pattern
- The `store` select always populates from the `$stores` Eloquent collection (`$store->id`, `$store->name`)
- All other selects use the `options` array from the field definition
- Every select starts with an empty disabled/hidden placeholder option
- When `in_popup` is falsy (default), a `WowForm` instance is automatically initialized via `@push('scripts')` using `form_id`. If `ajax` is `false`, the instance is created with `{ ajax: false }`
- When `in_popup` is `true`, the script is skipped — `WowPopup` handles form creation internally. Use the `ajax`, `captcha` and other options in `WowPopup`'s `form` sub-options instead

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

#### Checkbox captcha

```blade
@include('partials.template-form', [
    'source'  => 'feedback-page',
    'form_id' => 'feedback',
    'captcha' => 'checkbox',
])
```

#### Checkbox captcha with native submission

```blade
@include('partials.template-form', [
    'source'  => 'apply-page',
    'form_id' => 'apply',
    'ajax'    => false,
    'captcha' => 'checkbox',
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
| `form` | bool / array | No | `false` | When `true`, renders `template-form` with `source` and `form_id` defaulting to `$name`. When an array, passes those values as [template-form parameters](#template-formbladephp) (merged with defaults). `in_popup` is always set to `true`. The `captcha` value, when present, is also forwarded to the JS `WowPopup` initialization |

### Slots

| Slot | Description |
|---|---|
| `$styles` | Custom styles. Rendered before the popup HTML |
| `$close_img` | Custom close button image/content. Defaults to `×` |
| `$form_text` | Content above the form (only when `$form` is set) |
| `$popup_default` | Content inside `.popup-default`. When `$form` is set, rendered **below** the form. When `$form` is not set, this is the sole content. |
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
@component(theme('components.template-popup'), ['name' => 'march', 'form' => true])

    @slot('form_text')
        <h2>Contact Us</h2>
    @endslot

    @slot('popup_thanks')
        <h3>Thank you!</h3>
        <p>We'll be in touch soon.</p>
    @endslot

@endcomponent
```

#### Popup with custom form options

Pass an array to `form` to override `template-form` parameters.

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

#### Popup without a form

When `form` is not set, use `popup_default` for all content.

```blade
@component(theme('components.template-popup'), ['name' => 'gallery'])

    @slot('popup_default')
        <div class="gallery-grid">
            <img src="/images/photo1.jpg" alt="Photo 1">
            <img src="/images/photo2.jpg" alt="Photo 2">
        </div>
    @endslot

@endcomponent
```

#### Popup with form and content below it

Use `popup_default` alongside `$form` to render supplementary content beneath the form — useful for legal copy, trust badges, or secondary links.

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

The `scripts` slot renders after the popup initialization script. Use `set()` to override form callbacks, toggle triggers, auto-show behaviour, and popup lifecycle hooks.

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
                captcha: 'checkbox',
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
        WowForm.get('march').set('captcha', 'checkbox');
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

#### Scratch-card game popup

Uses `popup_steps` for the game screen and `scripts` for the scratch logic.

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

### Standalone form with checkbox captcha

```js
new WowForm('feedback', {
    containerId: '#feedback-form',
    captcha: 'checkbox',
    onSuccess: function (form, resp) {
        $('#feedback-form').html('<p>Thanks for your feedback!</p>');
    },
});
```

### Standalone native form (no AJAX)

```js
new WowForm('apply', {
    containerId: '#apply-form',
    ajax: false,
    beforePost: function (form, $form) {
        // Append hidden fields before native submit
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
WowForm.get('contact').set('captcha', 'checkbox');
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

### Popup with checkbox captcha

```js
new WowPopup('contact', {
    form: {
        captcha: 'checkbox',
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

Create a popup with default form handling, then override specific options later.

```js
// Initialize with defaults
var popup_march = new WowPopup('march', { form: true });

// Override form callbacks and switch to checkbox captcha later
popup_march.set('form', {
    captcha: 'checkbox',
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

The default toggle class `.toggle-{name}-popup` is always registered. Use `toggleClasses` for additional triggers.

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
        captcha: 'checkbox',
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

// Update options at runtime
WowPopup.get('contact').set('onShow', function () { console.log('opened'); });
WowForm.get('newsletter').set('onSuccess', function () { alert('done'); });

// Switch captcha type at runtime
WowForm.get('newsletter').set('captcha', 'checkbox');

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

### Form

```html
<form method="post" action="/submitLead" class="uni-style" data-captcha-type="invisible">

    <input type="hidden" name="_token" value="...">
    <input type="hidden" name="source" value="{source}">
    <input type="hidden" name="smart_id" value="{smart_id}">
    <!-- Rendered by <x-inputs.captcha-type> -->
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

### CSS classes used

| Class | Applied to | Description |
|---|---|---|
| `scrolllock-on` | `body` | Added when a popup is open |
| `focused` | `.field-wrapper` | Input inside is focused |
| `has-value` | `.field-wrapper` | Input has a non-empty value |
| `validation-error` | `.field-wrapper` | Input failed native or server-side validation |
| `captcha-error` | `.captcha` | Checkbox captcha was not checked before submit |
| `captcha-rendered` | `form` | reCAPTCHA has been rendered on this form |
| `recaptcha-loaded` | `html` | reCAPTCHA script has loaded |