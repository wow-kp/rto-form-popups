# rto-form-popups

Lightweight jQuery-based system for managing popups, forms, scroll-locking and reCAPTCHA.

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

## Usage Examples

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
                <div class="form-row flex">
                    <div class="form-field">
                        <div class="field-wrapper">
                            <input type="text" name="name" required>
                        </div>
                    </div>
                    <div class="form-field">
                        <div class="field-wrapper">
                            <input type="email" name="email" required>
                        </div>
                    </div>
                </div>
                <div class="captcha"></div>
                <button type="submit" disabled>Submit</button>
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