// =============================================================================
// WowRecaptcha — Global reCAPTCHA loader and renderer
// =============================================================================

var WowRecaptcha = (function () {
    'use strict';

    var _keys    = { v2_invisible: null, v2_checkbox: null, v3: null };
    var _loaded  = false;
    var _loading = false;
    var _queue   = [];
    var observer = null;

    function init(keys) {
        if (typeof keys === 'string') {
            _keys.v2_invisible = keys;
        } else if (keys && typeof keys === 'object') {
            if (keys.v2_invisible) _keys.v2_invisible = keys.v2_invisible;
            if (keys.v2_checkbox)  _keys.v2_checkbox  = keys.v2_checkbox;
            if (keys.v3)           _keys.v3            = keys.v3;
        }
        _observe();
    }

    function getSitekey(type) {
        return _keys[type] || _keys.v2_invisible || _keys.v2_checkbox || null;
    }

    function isLoaded() { return _loaded; }

    // Decide the script URL at load time (not init time) so the DOM has been
    // fully stamped with data-captcha-type by every WowForm._init() call.
    //
    // Rules:
    //   - Any v3 form on the page + v3 key configured
    //     → ?render={v3_sitekey}  (covers v2 explicit widgets too)
    //   - Otherwise
    //     → ?render=explicit      (v2 only, lighter)
    //
    // This means a globally-registered v3 key on <html> has no effect on pages
    // that only contain v2 forms.
    function _scriptUrl() {
        var base  = 'https://www.google.com/recaptcha/api.js?onload=WowRecaptchaOnLoad';
        var hasV3 = !!document.querySelector('form[method="post"][data-captcha-type="v3"]');
        return (hasV3 && _keys.v3) ? base + '&render=' + _keys.v3 : base + '&render=explicit';
    }

    // Load the reCAPTCHA script. Accepts an optional callback that fires once
    // the script is ready — safe to call multiple times.
    function load(callback) {
        if (_loaded) {
            renderForms();
            if (callback) callback();
            return;
        }
        if (callback) _queue.push(callback);
        if (_loading) return;
        _loading = true;

        window.WowRecaptchaOnLoad = onLoad;

        var tag   = document.createElement('script');
        tag.src   = _scriptUrl();
        tag.async = true;
        document.head.appendChild(tag);
    }

    function onLoad() {
        _loaded = true;
        $('html').addClass('recaptcha-loaded');
        renderForms();
        for (var i = 0; i < _queue.length; i++) _queue[i]();
        _queue = [];
    }

    // Execute reCAPTCHA v3 and resolve with a fresh token.
    // Triggers script load automatically if not already loaded.
    function executeV3(action) {
        return new Promise(function (resolve, reject) {
            if (!_keys.v3) { reject(new Error('No v3 sitekey configured')); return; }
            function run() {
                grecaptcha.ready(function () {
                    grecaptcha.execute(_keys.v3, { action: action || 'submit' })
                        .then(resolve)
                        .catch(reject);
                });
            }
            _loaded ? run() : load(run);
        });
    }

    function renderForms() {
        $('form[method="post"]:not(.captcha-rendered)').each(function () {
            var $form = $(this);
            var type  = $form.data('captcha-type') || 'v2_invisible';

            // v3: no visible widget — just enable the submit button and mark done
            if (type === 'v3') {
                $form.addClass('captcha-rendered');
                $form.find(':submit').prop('disabled', false);
                return;
            }

            var $captchaEl = $form.find('.captcha');
            if (!$captchaEl.length) return;

            var sitekey = getSitekey(type);
            if (!sitekey) return;

            var renderOpts = {
                'sitekey' : sitekey,
                'callback': function () { $form.trigger('captcha:resolved'); },
            };
            if (type === 'v2_invisible') renderOpts.size = 'invisible';

            var captchaId = grecaptcha.render($captchaEl[0], renderOpts);
            $form.addClass('captcha-rendered');
            $form.attr('data-captcha-id', captchaId);
            $form.find(':submit').prop('disabled', false);
        });
    }

    function _observe() {
        // Mark v3 forms immediately — they need no script for initial render
        renderForms();

        // Lazily load the script when any form enters the viewport.
        // Observing v3 forms too ensures the script is warm before the user submits.
        if (!('IntersectionObserver' in window)) { load(); return; }
        observer = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    load();
                    observer.unobserve(entries[i].target);
                }
            }
        });
        document.querySelectorAll('form[method="post"]').forEach(function (form) {
            observer.observe(form);
        });
    }

    // Auto-init from <html data-sitekey="..." data-sitekey_cb="..." data-sitekey_v3="...">
    var _el  = document.documentElement;
    var _sk  = _el.getAttribute('data-sitekey');
    var _scb = _el.getAttribute('data-sitekey_cb');
    var _sv3 = _el.getAttribute('data-sitekey_v3');
    if (_sk || _scb || _sv3) {
        $(function () {
            init({ v2_invisible: _sk, v2_checkbox: _scb, v3: _sv3 });
        });
    }

    return { init: init, getSitekey: getSitekey, isLoaded: isLoaded, executeV3: executeV3, onLoad: onLoad, renderForms: renderForms, load: load };
})();


// =============================================================================
// WowScrollLock — Scroll-lock with iOS position preservation
// =============================================================================

var WowScrollLock = (function () {
    'use strict';

    var _locked = false, _scrollY = 0;

    function lock() {
        if (_locked) return;
        _locked  = true;
        _scrollY = window.pageYOffset || window.scrollY;
        document.body.style.top = '-' + _scrollY + 'px';
        document.body.classList.add('scrolllock-on');
    }

    function unlock() {
        if (!_locked) return;
        _locked = false;
        document.body.classList.remove('scrolllock-on');
        document.body.style.removeProperty('top');
        window.scrollTo(0, _scrollY);
    }

    function isLocked() { return _locked; }

    return { lock: lock, unlock: unlock, isLocked: isLocked };
})();


// =============================================================================
// WowForm — Form handler (field states, validation, captcha, AJAX submit)
// =============================================================================

var WowForm = (function () {
    'use strict';

    var _emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function _validateEmail() {
        var val = this.value;
        if (val.length > 0) {
            if (_emailRegex.test(val)) {
                this.setCustomValidity('');
                this.parentNode.classList.remove('validation-error');
            } else {
                this.setCustomValidity('Enter a valid email address.');
            }
            this.reportValidity();
        } else {
            this.setCustomValidity('');
        }
    }

    var _instances = {};

    function WowForm(name, options) {
        this.name = name;
        this.options = $.extend({
            containerId : '#form-' + name,
            ajax        : true,
            captcha     : 'v2_invisible',   // 'v2_invisible' | 'v2_checkbox' | 'v3'
            beforePost  : null,
            onSuccess   : null,
            onError     : null,
        }, options || {});

        this.containerId = this.options.containerId;
        this.processing  = false;
        this._init();
        _instances[name] = this;
    }

    WowForm.get = function (name) {
        return _instances[name] || null;
    };

    WowForm.prototype._init = function () {
        var self = this;
        var cid  = self.containerId;

        $(cid + ' form[method="post"]').attr('data-captcha-type', self.options.captcha);

        // v3: no widget to render — enable submit immediately
        if (self.options.captcha === 'v3') {
            $(cid + ' :submit').prop('disabled', false);
        }

        $(cid + ' :input').inputmask({ showMaskOnHover: false, removeMaskOnSubmit: true });

        $(cid + ' [type="email"]').each(function () {
            this.addEventListener('input', _validateEmail);
        });

        $(document).on('focus.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').addClass('focused');
        });
        $(document).on('blur.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').removeClass('focused');
        });
        $(document).on('change.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').toggleClass('has-value', !!$(this).val());
        });

        $(document).on('input.' + self.name + ' change.' + self.name, cid + ' form :input', function () {
            if (this.validity.customError) {
                this.setCustomValidity('');
            }
        });

        document.querySelectorAll(cid + ' input, ' + cid + ' select, ' + cid + ' textarea')
            .forEach(function (el) {
                el.addEventListener('invalid', function () {
                    el.parentNode.classList.add('validation-error');
                }, false);
            });

        $(document).on('submit.' + self.name, cid + ' form', function (e) {
            e.preventDefault();
            if (self.processing) return;
            self.processing = true;

            var $form = $(this);

            // v3: get a fresh token, inject it as a hidden field, then submit
            if (self.options.captcha === 'v3') {
                WowRecaptcha.executeV3('submit').then(function (token) {
                    $form.find('[name="g-recaptcha-response-v3"]').remove();
                    $('<input>').attr({ type: 'hidden', name: 'g-recaptcha-response-v3', value: token })
                                .appendTo($form);
                    self._submit($form, null);
                }).catch(function () {
                    self.processing = false;
                });
                return;
            }

            // v2 invisible / checkbox
            var captchaId = $form.data('captcha-id');
            var token     = typeof captchaId !== 'undefined' ? grecaptcha.getResponse(captchaId) : null;

            if (token) {
                self._submit($form, captchaId);
            } else if (typeof captchaId !== 'undefined') {
                if (self.options.captcha === 'v2_checkbox') {
                    self.processing = false;
                    $form.find('.captcha').addClass('captcha-error');
                } else {
                    grecaptcha.execute(captchaId);
                    $form.one('captcha:resolved', function () {
                        self._submit($form, captchaId);
                    });
                }
            } else {
                self._submit($form, null);
            }
        });
    };

    WowForm.prototype._submit = function ($form, captchaId) {
        $form.find('.captcha').removeClass('captcha-error');

        if (this.options.ajax) {
            this._post($form, captchaId);
        } else {
            this._nativeSubmit($form, captchaId);
        }
    };

    WowForm.prototype._post = function ($form, captchaId) {
        var self = this;
        var data = $form.serialize();
        var url  = $form.attr('action');

        if (typeof self.options.beforePost === 'function') {
            data = self.options.beforePost(self, data) || data;
        }

        $.ajax({
            url     : url,
            method  : 'POST',
            data    : data,
            headers : {
                'Accept'       : 'application/json',
                'X-CSRF-TOKEN' : $form.find('[name="_token"]').val(),
            },
            success : function (resp) {
                if (resp.success) {
                    if (typeof self.options.onSuccess === 'function') {
                        self.options.onSuccess(self, resp);
                    }
                } else {
                    self._resetCaptcha(captchaId);
                    self._focusFirstError();
                    if (typeof self.options.onError === 'function') {
                        self.options.onError(self, resp);
                    }
                }
                self.processing = false;
            },
            error : function (xhr) {
                self._resetCaptcha(captchaId);
                self.processing = false;

                if (xhr.status === 422 && xhr.responseJSON && xhr.responseJSON.errors) {
                    self._applyServerErrors($form, xhr.responseJSON.errors);
                }
                if (typeof self.options.onError === 'function') {
                    self.options.onError(self, xhr.responseJSON || null);
                }
            },
        });
    };

    WowForm.prototype._nativeSubmit = function ($form, captchaId) {
        if (typeof this.options.beforePost === 'function') {
            this.options.beforePost(this, $form);
        }
        this.processing = false;
        $form[0].submit();
    };

    WowForm.prototype._applyServerErrors = function ($form, errors) {
        var $firstField = null;

        $.each(errors, function (fieldName, messages) {
            var $input = $form.find('[name="' + fieldName + '"]');
            if (!$input.length) return;

            var message = Array.isArray(messages) ? messages[0] : messages;

            $input[0].setCustomValidity(message);
            $input.closest('.field-wrapper').addClass('validation-error');

            if (!$firstField) $firstField = $input;
        });

        if ($firstField) {
            $firstField[0].reportValidity();
        }
    };

    WowForm.prototype._resetCaptcha = function (captchaId) {
        // v2 only — v3 tokens are obtained fresh on every submit, nothing to reset
        if (typeof captchaId !== 'undefined' && captchaId !== null) {
            grecaptcha.reset(captchaId);
        }
    };

    WowForm.prototype._focusFirstError = function () {
        var $el = $(this.containerId + ' form .field-wrapper.validation-error :input:visible').first();
        if ($el.length) $el.focus();
    };

    WowForm.prototype.reset = function () {
        var $form = $(this.containerId).find('form');
        if (!$form.length) return;
        $form[0].reset();
        $form.find('[name="g-recaptcha-response-v3"]').remove();
        $form.find(':input').each(function () {
            this.setCustomValidity('');
        });
        $(this.containerId).find('.field-wrapper').removeClass('focused has-value validation-error');
        $(this.containerId).find('.captcha').removeClass('captcha-error');
        $(this.containerId).find('select').each(function () {
            $(this).closest('.field-wrapper').toggleClass('has-value', !!$(this).val());
        });
        this._resetCaptcha($form.data('captcha-id'));
        $form.removeClass('captcha-executed');
    };

    WowForm.prototype.set = function (key, value) {
        this.options[key] = value;

        switch (key) {
            case 'containerId':
                var oldName = this.name;
                this.destroy();
                this.name = oldName;
                this.containerId = value;
                this._init();
                _instances[oldName] = this;
                break;

            case 'captcha':
                var $form = $(this.containerId).find('form');
                if ($form.length) {
                    if (value !== 'v3') {
                        this._resetCaptcha($form.data('captcha-id'));
                    }
                    $form.attr('data-captcha-type', value);
                    $form.removeClass('captcha-rendered').removeAttr('data-captcha-id');
                    $form.find('.captcha').empty().removeClass('captcha-error');
                    $form.find('[name="g-recaptcha-response-v3"]').remove();

                    if (value === 'v3') {
                        $form.find(':submit').prop('disabled', false);
                    } else {
                        $form.find(':submit').prop('disabled', true);
                        if (WowRecaptcha.isLoaded()) WowRecaptcha.renderForms();
                    }
                }
                break;

            case 'ajax':
            case 'beforePost':
            case 'onSuccess':
            case 'onError':
                break;
        }

        return this;
    };

    WowForm.prototype.destroy = function () {
        $(document).off('.' + this.name);
        $(this.containerId + ' [type="email"]').each(function () {
            this.removeEventListener('input', _validateEmail);
        });
        delete _instances[this.name];
    };

    return WowForm;
})();


// =============================================================================
// WowPopup — Popup lifecycle (show / hide / toggle / scroll-lock)
// =============================================================================

var WowPopup = (function () {
    'use strict';

    var _instances = {};
    var _active    = null;

    function WowPopup(name, options) {
        this.name = name;
        this.options = $.extend({
            popupId       : '#popup-' + name,
            toggleClasses : null,
            resetOnHide   : true,
            form          : null,
            autoShow      : null,
            onShow        : null,
            onHide        : null,
        }, options || {});

        this.popupId   = this.options.popupId;
        this._internal = false;

        this.toggleClass = '.toggle-' + name + '-popup';
        if (this.options.toggleClasses) {
            this.toggleClass += ', ' + this.options.toggleClasses;
        }

        this._init();
        this._initForm();
        this._initAutoShow();
        _instances[name] = this;

        // Watch for visibility changes triggered externally (e.g. $('.popup').toggle())
        // to keep _active tracking and scroll-lock in sync without monkey-patching jQuery.
        var self = this;
        var el   = document.querySelector(self.popupId);
        if (el) {
            self._observer = new MutationObserver(function () {
                if (self._internal) return;
                var visible = $(self.popupId).is(':visible');
                if (visible && _active !== self) {
                    if (_active) _active.hide();
                    _active = self;
                    WowScrollLock.lock();
                    WowRecaptcha.isLoaded() ? WowRecaptcha.renderForms() : WowRecaptcha.load();
                    if (typeof self.options.onShow === 'function') self.options.onShow(self);
                } else if (!visible && _active === self) {
                    _active = null;
                    WowScrollLock.unlock();
                    if (typeof self.options.onHide === 'function') self.options.onHide(self);
                }
            });
            self._observer.observe(el, { attributes: true, attributeFilter: ['style'] });
        }
    }

    WowPopup.get = function (name) {
        return _instances[name] || null;
    };

    WowPopup.prototype._getFormName = function () {
        var form = this.options.form;
        return (form && typeof form === 'object' && form.name) || this.name;
    };

    WowPopup.prototype._initForm = function () {
        if (!this.options.form) return;
        var formOpts = this.options.form === true ? {} : this.options.form;
        var formName = this._getFormName();
        var pid  = this.popupId;
        var opts = $.extend({
            containerId: pid,
            onSuccess: function () {
                $(pid + ' .popup-default, ' + pid + ' .popup-thanks').toggle();
            },
        }, formOpts);
        delete opts.name;
        new WowForm(formName, opts);
    };

    WowPopup.prototype._init = function () {
        var self = this;

        $(document).on('click.' + self.name, self.toggleClass, function (e) {
            e.preventDefault();
            $(self.popupId).is(':visible') ? self.hide() : self.show();
        });

        $(document).on('click.' + self.name, self.popupId + ' .popup-close', function (e) {
            e.preventDefault();
            self.hide();
        });
    };

    WowPopup.prototype._initAutoShow = function () {
        if (!this.options.autoShow) return;
        var self = this;
        var auto = self.options.autoShow === true ? {} : self.options.autoShow;
        var key  = 'wowpopup-' + self.name;

        setTimeout(function () {
            if (auto.showOnce && sessionStorage.getItem(key)) return;
            if (_active) return;
            self.show();
        }, auto.delay || 0);
    };

    WowPopup.prototype.show = function () {
        if (_active === this) return;
        if (_active) _active.hide();

        this._internal = true;
        $(this.popupId).show();
        this._internal = false;

        WowScrollLock.lock();
        _active = this;

        if (WowRecaptcha.isLoaded()) {
            WowRecaptcha.renderForms();
        } else {
            WowRecaptcha.load();
        }

        if (typeof this.options.onShow === 'function') {
            this.options.onShow(this);
        }
    };

    WowPopup.prototype.hide = function () {
        var $popup = $(this.popupId);
        if (!$popup.is(':visible')) return;

        this._internal = true;
        $popup.hide();
        this._internal = false;

        if (_active === this) _active = null;
        WowScrollLock.unlock();

        var auto = this.options.autoShow;
        if (auto && typeof auto === 'object' && auto.showOnce) {
            sessionStorage.setItem('wowpopup-' + this.name, '1');
        }

        if (this.options.resetOnHide) {
            $(this.popupId).find('.popup-content > div').hide();
            $(this.popupId).find('.popup-default').show();
            var form = WowForm.get(this._getFormName());
            if (form) form.reset();
        }

        if (typeof this.options.onHide === 'function') {
            this.options.onHide(this);
        }
    };

    WowPopup.prototype.set = function (key, value) {
        this.options[key] = value;

        switch (key) {
            case 'form':
                var oldFormName = this._getFormName();
                var oldForm = WowForm.get(oldFormName);
                if (oldForm) oldForm.destroy();
                if (value) this._initForm();
                break;

            case 'toggleClasses':
                $(document).off('click.' + this.name, this.toggleClass);
                this.toggleClass = '.toggle-' + this.name + '-popup';
                if (value) this.toggleClass += ', ' + value;
                var self = this;
                $(document).on('click.' + self.name, self.toggleClass, function (e) {
                    e.preventDefault();
                    $(self.popupId).is(':visible') ? self.hide() : self.show();
                });
                break;

            case 'autoShow':
                this._initAutoShow();
                break;

            case 'onShow':
            case 'onHide':
            case 'resetOnHide':
            case 'popupId':
                break;
        }

        return this;
    };

    WowPopup.prototype.destroy = function () {
        if (_active === this) this.hide();
        $(document).off('.' + this.name);
        $(this.popupId).off('.' + this.name);
        if (this._observer) this._observer.disconnect();
        delete _instances[this.name];
    };

    return WowPopup;
})();