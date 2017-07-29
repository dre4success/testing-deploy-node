function autocomplete(input, latInput, lngInput) {
	// console.log(input, latInput, lngInput);
	if(!input) return; // skip this fn from running if there is not input on the page
	const dropdown = new google.maps.places.Autocomplete(input);

	dropdown.addListener('place_changed', () => {
		const place = dropdown.getPlace();
		// console.log(place);
		latInput.value = place.geometry.location.lat();
		lngInput.value = place.geometry.location.lng();
	});
	// if someone hits enter on the address field, don't submit the form
	input.on('keydown', (e) => {
		if (e.keycode === 13) e.preventDefault(); // 13 is enter, prevent enter from saving our form
	})
}

export default autocomplete;