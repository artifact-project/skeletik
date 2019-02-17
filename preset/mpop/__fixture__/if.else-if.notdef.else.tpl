<!-- IF TestServer && Eq(GET_x,1) -->
	Hi, ##UserName##!!
<!-- ELSE IFNOT GET_id -->
	IFNOT
<!-- ELSE IFDEF GET_email -->
	IFDEF
<!-- ELSE IFNOTDEF TestServer -->
	IFNOTDEF
<!-- ELSE -->
	##JsonEncode(GET_id)##
<!-- /IF -->