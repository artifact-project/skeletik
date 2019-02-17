<!-- IF TestServer && Eq(GET_x,1) -->
	Hi, ##UserName##!!
<!-- ELSE IF !!TestServer -->
	##HOST##
<!-- ELSE -->
	##JsonEncode(GET_id)##
<!-- /IF -->