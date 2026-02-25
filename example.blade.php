{{-- ================================================================
     EXAMPLE: template-popup usage patterns
     ================================================================ --}}


{{------------------------------------------------------------------
     1. SIMPLE POPUP WITH FORM (all defaults)
     ----------------------------------------------------------------
     - Passing form=true auto-renders template-form with source=$name
     - Default success: toggles .popup-default / .popup-thanks
     ------------------------------------------------------------------}}

<button class="toggle-simple-popup">Open Simple Popup</button>

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


{{------------------------------------------------------------------
	2. POPUP WITH CUSTOM FORM OPTIONS
	----------------------------------------------------------------
	- Pass an array to $form to override template-form parameters
	- form_text slot adds content above the form
	------------------------------------------------------------------}}

<button class="toggle-quote-popup">Get a Quote</button>

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


{{------------------------------------------------------------------
	3. POPUP WITH CUSTOM CALLBACKS VIA set()
	----------------------------------------------------------------
	- Initialize with defaults, then override per-page via scripts slot
	------------------------------------------------------------------}}

<button class="toggle-march-popup">March Promo</button>

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


{{------------------------------------------------------------------
	4. POPUP WITHOUT A FORM (gallery / info)
	----------------------------------------------------------------
	- When form is not set, use popup_default for content
	------------------------------------------------------------------}}

<button class="toggle-gallery-popup">View Gallery</button>

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


{{------------------------------------------------------------------
	5. POPUP WITH SCRATCH-CARD GAME
	----------------------------------------------------------------
	- Uses $i for image root path
	- popup_steps slot for the scratch game screen
	- Custom onSuccess via scripts slot starts the scratch game
	------------------------------------------------------------------}}

@php $i = '/themes/' . getAccount()->theme . '/promos/25/aug/images'; @endphp

<button class="toggle-scratch-popup">Play & Win!</button>

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


{{------------------------------------------------------------------
	6. POPUP WITH CUSTOM STYLES AND CLOSE IMAGE
	------------------------------------------------------------------}}

<button class="toggle-promo-popup">Special Offer</button>

@component(theme('components.template-popup'), [
	'name' => 'promo',
	'i'    => '/themes/rent2own/promos/25/aug/images',
	'form' => [
		'source'     => 'promo-offer',
		'submit_text' => 'Claim Offer',
	],
])

	@slot('styles')
		<link rel="stylesheet" href="/themes/{{ $account->theme }}/promos/25/aug/css/popup.css">
	@endslot

	@slot('close_img')
		<img src="/themes/rent2own/images/close-white.svg" alt="Close">
	@endslot

	@slot('form_text')
		<h2>Exclusive Offer!</h2>
		<p>Limited time only — claim yours now.</p>
	@endslot

	@slot('popup_thanks')
		<h3>Offer Claimed!</h3>
		<p>Check your inbox.</p>
	@endslot

@endcomponent


{{------------------------------------------------------------------
	7. POPUP WITH FULLY CUSTOM FORM ROWS
	------------------------------------------------------------------}}

<button class="toggle-feedback-popup">Leave Feedback</button>

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
				['name' => 'department', 'type' => 'select', 'label' => 'Department', 'required' => true, 'options' => ['sales' => 'Sales', 'support' => 'Support', 'other' => 'Other']],
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