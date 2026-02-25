{{--
    Reusable popup component.

    Parameters:
        $name — Required. Unique popup identifier
        $i    — Optional. Image root path (data-imgroot)
        $form — Optional. When truthy, renders template-form inside .popup-default

    Slots:
        $styles        — Custom CSS styles 
        $close_img     — Custom close button image/content
        $form_text     — Content above the form (only when $form is set)
        $popup_default — Main popup content (only when $form is NOT set)
        $popup_steps   — Additional popup steps/screens
        $popup_thanks  — Thank-you content
        $scripts       — Custom JS (runs after WowPopup initialization)
--}}
@php
    $name = $name ?? '';
    $i    = $i ?? '';
    $form = $form ?? false;
@endphp
@if(!empty($name))
    @push('styles')
        @isset($styles)
            {{ $styles }}
        @endisset
    @endpush
    <section id="popup-{{$name}}" class="popup fixed top-0 left-0 flex justify-center items-center overflow-hidden z4 cont-full" data-imgroot="{{$i}}" data-slideout-ignore style="display: none">
        <div class="popup-overlay absolute top-0 left-0 cont-full"></div>
        <div class="popup-content fit relative">
            @isset($close_img)
                <span class="clickable popup-close absolute flex justify-center items-center absolute top-0 right-0 z4 toggle-{{$name}}-popup uses-image">
                    {{ $close_img }}
                </span>
            @else
                <button type="button" class="clickable popup-close absolute flex justify-center items-center absolute top-0 right-0 z4 toggle-{{$name}}-popup no-app no-border transparent">
                    Close popup
                </button>
            @endisset
            <div class="popup-default popup-inner fit mx-auto relative flex items-center justify-center full-width full-height">
                <div class="popup-form fit">
                    @isset($form_text)
                        {{ $form_text }}
                    @endisset
                    @isset($form)
                        @include(theme('components.template-form'), array_merge( ['source' => $name, 'in_popup' => true], is_array($form) ? $form : [] ))
                    @else
                        @isset($popup_default)
                            {{ $popup_default }}
                        @endisset
                    @endisset
                </div>
            </div>
            @isset($popup_steps)
                {{ $popup_steps }}
            @endisset
            @isset($form)
                <div class="popup-thanks popup-inner mx-auto fit relative flex flex-column items-center justify-center full-width full-height" style="display: none;">
                    <!-- Do not Remove! For tracking Purposes -->
                    <div class="tracking_promo_success">
                        <img src="{{$i}}/promo_success.png" class="promo_image" alt=""/>
                    </div>
                    @isset($popup_thanks)
                        {{ $popup_thanks }}
                    @endisset
                </div>
            @endisset
        </div>
    </section>
    @push('scripts')
        <script type="text/javascript">
            jQuery(document).ready(function($){
                var popup_{{$name}} = new WowPopup('{{$name}}', {
                    form: {{ isset($form) ? 'true' : 'null' }}
                });
            });
        </script>
        @isset($scripts)
            {{ $scripts }}
        @endisset
    @endpush
@endif