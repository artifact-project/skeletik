<!-- IF TestServer && Eq(GET_x,1) -->
	Hi, ##UserName##?!
<!-- ELSEIF !TestServer -->
	##HOST##
<!-- ELSE -->
	##JsonEncode(GET_id)##
<!-- /IF -->