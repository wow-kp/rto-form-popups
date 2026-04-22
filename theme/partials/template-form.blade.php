@if (!empty($source) && !empty($form_id))
    @pushOnce('styles')
	    <link rel="stylesheet" type="text/css" href="/themes/{{$account->theme}}/css/forms.css">
    @endPushOnce
    @php
        $action          = $action ?? '/submitLead';
        $ajax            = $ajax ?? true;
        $captcha         = $captcha ?? 'v2_invisible';
        $smart_id        = $smart_id ?? '';
        $hidden_fields   = $hidden_fields ?? [];
        $rows            = $rows ?? null;
        $excluded_fields = $excluded_fields ?? [];
        $submit_text     = $submit_text ?? 'Submit';
        $submit_class    = $submit_class ?? '';
        $tabindex_start  = $tabindex_start ?? 40;

        // Default rows
        $default_rows = [
            [
                ['name' => 'first_name', 'label' => 'First Name', 'required' => true],
                ['name' => 'last_name',  'label' => 'Last Name',  'required' => true],
            ],
            [
                ['name' => 'email', 'type' => 'email', 'label' => 'Email Address', 'required' => true],
                ['name' => 'phone', 'type' => 'tel',   'label' => 'Phone Number',  'required' => true],
            ],
            [
                ['name' => 'store', 'type' => 'select', 'label' => 'Select a Store', 'required' => true],
            ],
            [
                ['name' => 'message', 'label' => 'Tell us an item you\'re interested in!'],
            ],
        ];

        // Resolve rows
        $active_rows = $rows ?? $default_rows;

        // Apply excluded_fields
        if (!empty($excluded_fields)) {
            $active_rows = array_values(array_filter(
                array_map(function ($row) use ($excluded_fields) {
                    return array_values(array_filter($row, function ($field) use ($excluded_fields) {
                        return !in_array($field['name'], $excluded_fields);
                    }));
                }, $active_rows),
                function ($row) { return !empty($row); }
            ));
        }

        $tabindex = $tabindex_start;
    @endphp

    <form method="post" action="{{ $action }}" class="uni-style form text-left fit mx-auto">

        {{-- CSRF token --}}
        @csrf

        {{-- Required hidden fields --}}
        <input type="hidden" name="source" value="{{ $source }}">
        <input type="hidden" name="smart_id" value="{{ $smart_id }}">
        <x-inputs.captcha-type type="{{ $captcha }}" />

        {{-- Additional hidden fields --}}
        @foreach ($hidden_fields as $h_name => $h_value)
            <input type="hidden" name="{{ $h_name }}" value="{{ $h_value }}">
        @endforeach

        {{-- Visible field rows --}}
        @foreach ($active_rows as $row)
            <div class="form-row flex">
                @foreach ($row as $field)
                    @php
                        $type      = $field['type'] ?? 'text';
                        $name      = $field['name'];
                        $id        = $field['id'] ?? $name;
                        $label     = $field['label'] ?? ucwords(str_replace('_', ' ', $name));
                        $required  = !empty($field['required']);
                        $inputmask = $type === 'tel' ? "'mask': '(999) 999-9999'" : ($field['inputmask'] ?? null);
                        $pattern   = $type === 'tel' ? '\(\d{3}\) \d{3}-\d{4}'   : ($field['pattern'] ?? null);
                        $options   = $field['options'] ?? [];
                        // Whitelist-sanitized attributes — keeps only known-safe keys,
                        // escapes both key and value. 'attributes' must be an array, never a string.
                        $allowed   = ['disabled', 'readonly', 'placeholder', 'autocomplete', 'maxlength', 'min', 'max', 'step', 'class'];
                        $extra     = collect($field['attributes'] ?? [])
                                        ->filter(fn($v, $k) => in_array($k, $allowed) || str_starts_with($k, 'data-'))
                                        ->map(fn($v, $k) => e($k) . '="' . e($v) . '"')
                                        ->implode(' ');
                        $tabindex++;
                    @endphp
                    <div class="form-field">
                        <div class="field-wrapper relative flex items-center{{ $type === 'select' ? ' select_box' : '' }}">
                            <label for="{{ $id }}" class="absolute z1 events-none">{{ $label }}@if($required)<span class="f-red">*</span>@endif</label>

                            @if ($type === 'select')
                                <select
                                    name="{{ $name }}"
                                    id="{{ $id }}"
                                    class="border border-gray avenir-medium mx-auto no-app not-selectric not-select"
                                    tabindex="{{ $tabindex }}"
                                    @if ($required) required @endif
                                    {!! $extra !!}
                                >
                                    <option value="" disabled hidden selected></option>
                                    @if ($name === 'store' && isset($stores))
                                        @foreach ($stores as $store)
                                            <option value="{{ $store->id }}">{{ $store->name }}</option>
                                        @endforeach
                                    @else
                                        @foreach ($options as $opt_value => $opt_label)
                                            <option value="{{ $opt_value }}">{{ $opt_label }}</option>
                                        @endforeach
                                    @endif
                                </select>
                            @elseif ($type === 'textarea')
                                <textarea
                                    name="{{ $name }}"
                                    id="{{ $id }}"
                                    class="border border-gray avenir-medium mx-auto"
                                    tabindex="{{ $tabindex }}"
                                    @if ($required) required @endif
                                    {!! $extra !!}
                                ></textarea>
                            @elseif ($type === 'file')
                                <div class="file-fake-input border border-gray avenir-book flex items-center clickable justify-between overflow-hidden relative">
                                    <span class="file-name-text overflow-hidden"></span>
                                    <span class="file-browse-text avenir-book f-white flex items-center absolute top-0 right-0 full-height">Browse</span>
                                </div>
                                <input
                                    type="file"
                                    name="{{ $name }}"
                                    id="{{ $id }}"
                                    class="file-input-overlay absolute full-width full-height cont-full clickable z2"
                                    tabindex="{{ $tabindex }}"
                                    {!! $extra !!}
                                >
                                <textarea
                                    name="{{ $name }}"
                                    id="{{ $id }}"
                                    class="border border-gray avenir-medium mx-auto"
                                    tabindex="{{ $tabindex }}"
                                    @if ($required) required @endif
                                    {!! $extra !!}
                                ></textarea>
                            @else
                                <input
                                    type="{{ $type }}"
                                    name="{{ $name }}"
                                    id="{{ $id }}"
                                    class="border border-gray avenir-medium mx-auto"
                                    tabindex="{{ $tabindex }}"
                                    @if ($required) required @endif
                                    @if ($inputmask) data-inputmask="{{ $inputmask }}" @endif
                                    @if ($pattern) pattern="{{ $pattern }}" @endif
                                    {!! $extra !!}
                                >
                            @endif
                        </div>
                    </div>
                @endforeach
            </div>
        @endforeach

        {{-- Captcha + Submit --}}
        <div class="form-action">
            @if ($captcha !== 'v3')
                <div id="{{$form_id}}-captcha" class="captcha"></div>
            @endif
            <button type="submit" class="button flex items-center justify-center border-none uppercase relative avenir-black fit text-center {{ $submit_class }}"{{ $captcha === 'v3' ? '' : ' disabled' }} tabindex="{{ ++$tabindex }}">
                {{ $submit_text }}
            </button>
        </div>

    </form>
    @empty ($in_popup)
        @push('scripts')
            <script type="text/javascript">
                jQuery(document).ready(function($){
                    @php
                        $form_options = [];
                        if (!$ajax)                      $form_options['ajax']    = false;
                        if ($captcha !== 'v2_invisible') $form_options['captcha'] = $captcha;
                    @endphp
                    var form_{{str_replace('-', '_', $form_id)}} = new WowForm('{{$form_id}}'@if(!empty($form_options)), {!! json_encode($form_options, JSON_UNESCAPED_SLASHES) !!}@endif);
                });
            </script>
        @endpush
    @endempty
@endif