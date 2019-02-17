<!-- IF TestServer && Eq(GET_x,1) -->
	Hi, ##UserName##?
<!-- ELSEIFNOT TestServer -->
	##HOST##
<!-- ELSEIFDEF GET_id -->
	##GET_id##
<!-- ELSEIFNOTDEF GET_id -->
	##EMAIL##
<!-- ELSE -->
	##JsonEncode(GET_id)##
<!-- /IF -->