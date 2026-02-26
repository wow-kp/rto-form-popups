@if (!empty($source) && !empty($form_id))
    @php
        $action          = $action ?? '/submitLead';
        $ajax            = $ajax ?? true;
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
                        $extra     = $field['attributes'] ?? '';
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
            <div class="captcha"></div>
            <button type="submit" class="button inline-flex items-center justify-center border-none uppercase relative avenir-black fit text-center {{ $submit_class }}" disabled tabindex="{{ ++$tabindex }}">
                {{ $submit_text }}
            </button>
        </div>

    </form>
    @empty ($in_popup)
        @push('scripts')
            <script type="text/javascript">
                jQuery(document).ready(function($){
                    var form_{{$form_id}} = new WowForm('{{$form_id}}'{{ $ajax ? '' : ', { ajax: false }' }});
                });
            </script>
        @endpush
    @endempty
@endif