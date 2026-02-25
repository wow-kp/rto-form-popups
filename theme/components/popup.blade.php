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
                        @include(theme('partials.template-form'), $form)
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
            <div class="popup-thanks popup-inner mx-auto fit relative flex flex-column items-center justify-center full-width full-height" style="display: none;">
                <!-- Do not Remove! For tracking Purposes -->
                <div class="tracking_promo_success">
                    <img src="{{$i}}/promo_success.png" class="promo_image" alt=""/>
                </div>
                @isset($popup_thanks)
                    {{ $popup_thanks }}
                @endisset
            </div>
        </div>
    </section>
    @push('scripts')
        @isset($scripts)
            {{ $scripts }}
        @endisset
        <script type="text/javascript">
            jQuery(document).ready(function($){
                var popup_{{$name}} = new WowPopup('{{$name}}', {
                    form: {{ isset($form) ? 'true' : 'null' }}
                });
            });
        </script>
    @endpush
@endif