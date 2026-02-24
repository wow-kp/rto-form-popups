// =============================================================================
// WowRecaptcha — Global reCAPTCHA loader and renderer
// =============================================================================

var WowRecaptcha = (function () {

    var sitekey  = null;
    var loaded   = false;
    var loading  = false;
    var observer = null;

    function init(key) {
        sitekey = key;
        _observe();
    }

    function isLoaded() {
        return loaded;
    }

    function renderForms() {
        $('form[method="post"]:not(.captcha-rendered)').each(function () {
            var $form      = $(this);
            var $captchaEl = $form.find('.captcha');
            if (!$captchaEl.length) return;

            var captchaId = grecaptcha.render($captchaEl[0], {
                'sitekey' : sitekey,
                'size'    : 'invisible',
                'callback': function () {
                    $form.trigger('captcha:resolved');
                },
            });

            $form.addClass('captcha-rendered');
            $form.attr('data-captcha-id', captchaId);
            $form.find(':submit').prop('disabled', false);
        });
    }

    function _loadScript() {
        if (loaded) { renderForms(); return; }
        if (loading) return;
        loading = true;

        // Ensure callback is reachable as a flat global for reCAPTCHA's onload
        window.WowRecaptchaOnLoad = onLoad;

        var tag   = document.createElement('script');
        tag.src   = 'https://www.google.com/recaptcha/api.js?onload=WowRecaptchaOnLoad&render=explicit';
        tag.async = true;
        document.head.appendChild(tag);
    }

    function onLoad() {
        loaded = true;
        $('html').addClass('recaptcha-loaded');
        renderForms();
    }

    function _observe() {
        if (!('IntersectionObserver' in window)) { _loadScript(); return; }
        observer = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    _loadScript();
                    observer.unobserve(entries[i].target);
                }
            }
        });
        document.querySelectorAll('form[method="post"]').forEach(function (form) {
            observer.observe(form);
        });
    }

    // Auto-init from <html data-sitekey="...">
    var _key = document.documentElement.getAttribute('data-sitekey');
    if (_key) {
        $(function () { init(_key); });
    }

    return { init: init, isLoaded: isLoaded, onLoad: onLoad, renderForms: renderForms, load: _loadScript };
})();


// =============================================================================
// WowScrollLock — Scroll-lock with iOS position preservation
// =============================================================================

var WowScrollLock = (function () {

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

        // Input masks
        $(cid + ' :input').inputmask({ showMaskOnHover: false, removeMaskOnSubmit: true });

        // Email validation
        $(cid + ' [type="email"]').each(function () {
            this.addEventListener('input', _validateEmail);
        });

        // Field states
        $(document).on('focus.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').addClass('focused');
        });
        $(document).on('blur.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').removeClass('focused');
        });
        $(document).on('change.' + self.name, cid + ' form :input', function () {
            $(this).parent('.field-wrapper').toggleClass('has-value', !!$(this).val());
        });

        // Validation error marking
        document.querySelectorAll(cid + ' input, ' + cid + ' select, ' + cid + ' textarea')
            .forEach(function (el) {
                el.addEventListener('invalid', function () {
                    el.parentNode.classList.add('validation-error');
                }, false);
            });

        // Submit
        $(document).on('submit.' + self.name, cid + ' form', function (e) {
            e.preventDefault();
            if (self.processing) return;
            self.processing = true;

            var $form     = $(this);
            var captchaId = $form.data('captcha-id');
            var token     = typeof captchaId !== 'undefined' ? grecaptcha.getResponse(captchaId) : null;

            if (token) {
                self._post($form, captchaId);
            } else if (typeof captchaId !== 'undefined') {
                grecaptcha.execute(captchaId);
                $form.one('captcha:resolved', function () {
                    self._post($form, captchaId);
                });
            } else {
                self._post($form, null);
            }
        });
    };

    WowForm.prototype._post = function ($form, captchaId) {
        var self = this;
        var data = $form.serialize();
        var url  = $form.attr('action');

        if (typeof self.options.beforePost === 'function') {
            data = self.options.beforePost(self, data) || data;
        }

        $.post(url, data, function (resp) {
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
        }, 'json').fail(function () {
            self._resetCaptcha(captchaId);
            self.processing = false;
            if (typeof self.options.onError === 'function') {
                self.options.onError(self, null);
            }
        });
    };

    WowForm.prototype._resetCaptcha = function (captchaId) {
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
        $(this.containerId).find('.field-wrapper').removeClass('focused has-value validation-error');
        $(this.containerId).find('select').each(function () {
            if ($(this).find('option').length === 1) {
                $(this).closest('.field-wrapper').addClass('has-value');
            }
        });
        this._resetCaptcha($form.data('captcha-id'));
        $form.removeClass('captcha-executed');
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

    // Patch jQuery show/hide/toggle to fire events (used for external toggle capture)
    $.each(['show', 'hide', 'toggle'], function (i, ev) {
        var orig = $.fn[ev];
        $.fn[ev] = function () {
            var result = orig.apply(this, arguments);
            this.trigger(ev);
            return result;
        };
    });

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

        this.popupId = this.options.popupId;

        this.toggleClass = '.toggle-' + name + '-popup';
        if (this.options.toggleClasses) {
            this.toggleClass += ', ' + this.options.toggleClasses;
        }

        this._init();
        this._initForm();
        this._initAutoShow();
        _instances[name] = this;
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

        $(this.popupId).show();
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

    WowPopup.prototype.destroy = function () {
        if (_active === this) this.hide();
        $(document).off('.' + this.name);
        $(this.popupId).off('.' + this.name);
        delete _instances[this.name];
    };

    return WowPopup;
})();