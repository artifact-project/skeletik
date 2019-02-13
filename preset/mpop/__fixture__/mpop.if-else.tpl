<!-- IF TestServer && Eq(GET_x,1) -->
	Hi, ##UserName##
<!-- ELSE -->
	##JsonEncode(GET_id)##
<!-- /IF -->