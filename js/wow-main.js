// =============================================================================
// WowRecaptcha — Global reCAPTCHA loader and renderer
// Lazily loads the reCAPTCHA script when a post form enters the viewport.
// Renders captcha on any form[method="post"] that contains a .captcha element.
// =============================================================================

var WowRecaptcha = (function() {

    var sitekey  = null;
    var loaded   = false;
    var observer = null;

    function init(key) {
        sitekey = key;
        _observe();
    }

    function isLoaded() {
        return loaded;
    }

    function renderForms() {
        $('form[method="post"]:not(.captcha-rendered)').each(function() {
            var $form      = $(this);
            var $captchaEl = $form.find('.captcha');
            if (!$captchaEl.length) return;

            var captchaId = grecaptcha.render($captchaEl[0], {
                'sitekey' : sitekey,
                'size'    : 'invisible',
            });

            $form.addClass('captcha-rendered');
            $form.attr('data-captcha-id', captchaId);
            $form.find(':submit').prop('disabled', false);
        });
    }

    function _loadScript() {
        if (loaded) {
            renderForms();
            return;
        }
        var tag = document.createElement('script');
        tag.src   = 'https://www.google.com/recaptcha/api.js?onload=WowRecaptcha.onLoad&render=explicit';
        tag.async = true;
        document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
    }

    function onLoad() {
        loaded = true;
        $('html').addClass('recaptcha-loaded');
        renderForms();
    }

    function _observe() {
        if (!('IntersectionObserver' in window)) {
            _loadScript();
            return;
        }
        observer = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    _loadScript();
                    observer.unobserve(entries[i].target);
                }
            }
        });
        document.querySelectorAll('form[method="post"]').forEach(function(form) {
            observer.observe(form);
        });
    }

    return {
        init       : init,
        isLoaded   : isLoaded,
        onLoad     : onLoad,
        renderForms: renderForms,
    };

})();


// =============================================================================
// WowPopup — Per-instance form/popup handler
// Manages field states, captcha execution, submission and popup lifecycle.
// =============================================================================

var WowPopup = (function() {

    function WowPopup(name, options) {
        this.name = name;

        this.options = $.extend({
            popupId       : '#popup-' + name,
            formId        : null,               // defaults to popupId if not set
            toggleClasses : null,
            resetOnHide   : false,
            // Callbacks
            onShow        : null,
            onHide        : null,
            onSuccess     : null,
            beforePost    : null,
        }, options || {});

        this.popupId = this.options.popupId;
        this.formId  = this.options.formId || this.options.popupId;

        this.toggleClass = '.toggle-' + name + '-popup';
        if (this.options.toggleClasses) {
            this.toggleClass += ', ' + this.options.toggleClasses;
        }

        this.processing = false;

        this._init();
        this._initValidation();
    }

    // -------------------------------------------------------------------------
    // Form
    // -------------------------------------------------------------------------

    WowPopup.prototype._init = function() {
        var self = this;

        $(self.formId + ' :input').inputmask({
            showMaskOnHover   : false,
            removeMaskOnSubmit: true,
        });

        $(document).on('focus.' + self.name, self.formId + ' form :input', function() {
            $(this).parent('.field-wrapper').addClass('focused');
        });

        $(document).on('blur.' + self.name, self.formId + ' form :input', function() {
            $(this).parent('.field-wrapper').removeClass('focused');
        });

        $(document).on('change.' + self.name, self.formId + ' form :input', function() {
            $(this).parent('.field-wrapper').toggleClass('has-value', !!$(this).val());
        });

        $(document).on('click.' + self.name, self.toggleClass, function() {
            $(self.popupId).is(':visible') ? self._hide() : self._show();
        });

        $(document).on('submit.' + self.name, self.formId + ' form', function(e) {
            e.preventDefault();
            if (self.processing) return;
            self.processing = true;

            var $form     = $(self.formId + ' form');
            var captchaId = $form.data('captcha-id');
            var token     = typeof captchaId !== 'undefined' ? grecaptcha.getResponse(captchaId) : null;

            if (token) {
                self._submitForm($form, captchaId);
            } else if (typeof captchaId !== 'undefined') {
                grecaptcha.execute(captchaId);
                var poll = setInterval(function() {
                    var response = grecaptcha.getResponse(captchaId);
                    if (response) {
                        clearInterval(poll);
                        self._submitForm($form, captchaId);
                    }
                }, 300);
            } else {
                // No captcha on this form — submit directly
                self._submitForm($form, null);
            }
        });
    };

    WowPopup.prototype._initValidation = function() {
        var self = this;

        document.querySelectorAll(self.formId + ' input, ' + self.formId + ' select, ' + self.formId + ' textarea').forEach(function(input) {
            input.addEventListener('invalid', function() {
                input.parentNode.classList.add('validation-error');
            }, false);
        });
    };

    WowPopup.prototype._submitForm = function($form, captchaId) {
        var self = this;
        var data = $form.serialize();

        if (typeof self.options.beforePost === 'function') {
            data = self.options.beforePost(self, data) || data;
        }

        $.post($form.attr('action'), data, function(resp) {
            if (resp.success) {
                if (typeof self.options.onSuccess === 'function') {
                    self.options.onSuccess(self, resp);
                } else {
                    $(self.popupId + ' .popup-default, ' + self.popupId + ' .popup-thanks').toggle();
                }
            } else {
                if (typeof captchaId !== 'undefined' && captchaId !== null) {
                    grecaptcha.reset(captchaId);
                }
                self._focusFirstError();
            }
            self.processing = false;
        }).fail(function() {
            if (typeof captchaId !== 'undefined' && captchaId !== null) {
                grecaptcha.reset(captchaId);
            }
            self.processing = false;
        });
    };

    WowPopup.prototype._focusFirstError = function() {
        var $first = $(this.formId + ' form .field-wrapper.validation-error :input:visible').first();
        if ($first.length) {
            $first.focus();
        }
    };

    WowPopup.prototype._resetForm = function() {
        var $form = $(this.formId).find('form');
        if ($form.length) {
            $form[0].reset();
            $(this.formId).find('.field-wrapper').removeClass('focused has-value validation-error');
            $(this.formId).find('select').each(function() {
                if ($(this).find('option').length === 1) {
                    $(this).closest('.field-wrapper').addClass('has-value');
                }
            });
            var captchaId = $form.data('captcha-id');
            if (typeof captchaId !== 'undefined') {
                grecaptcha.reset(captchaId);
                $form.removeClass('captcha-executed');
            }
        }
        $(this.popupId).find('.popup-content > div').hide();
        $(this.popupId).find('.popup-default').show();
    };

    // -------------------------------------------------------------------------
    // Popup
    // -------------------------------------------------------------------------

    WowPopup.prototype._show = function() {
        var self   = this;
        var $popup = $(self.popupId);
        $popup.show();
        $('body').addClass('scrolllock-on');

        // Render captcha if not yet done (e.g. popup was hidden on page load)
        if (WowRecaptcha.isLoaded()) {
            WowRecaptcha.renderForms();
        }

        if (typeof self.options.onShow === 'function') {
            self.options.onShow(self);
        }
    };

    WowPopup.prototype._hide = function() {
        $(this.popupId).hide();
        $('body').removeClass('scrolllock-on');
        if (this.options.resetOnHide) {
            this._resetForm();
        }
        if (typeof this.options.onHide === 'function') {
            this.options.onHide(this);
        }
    };

    return WowPopup;

})();


/*
--- Usage ---

// Initialize reCAPTCHA — call once on the page
WowRecaptcha.init('your-sitekey-here');

// Basic popup usage
$(document).ready(function() {
    new WowPopup('spring');
});

// Usage with all options
$(document).ready(function() {
    new WowPopup('spring', {
        popupId       : '#popup-spring',            // the popup element (defaults to #popup-{name})
        formId        : '#my-form-container',       // element containing the form, defaults to popupId
        toggleClasses : '.some-other-trigger, #another-trigger',
        resetOnHide   : true,                       // reset form and popup state when closed
        onShow        : function(popup) {},
        onHide        : function(popup) {},
        beforePost    : function(popup, data) {
            // data is the serialized form string — return modified string to override
            return data + '&extra_param=value';
        },
        onSuccess     : function(popup, resp) {
            // default .popup-default / .popup-thanks toggle is skipped when defined
            $(popup.popupId + ' .popup-default, ' + popup.popupId + ' .popup-thanks').toggle();
        }
    });
});
*/