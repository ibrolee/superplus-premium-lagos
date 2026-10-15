import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeCmsHref} from "../src/lib/safe-site-href.ts";

test("public portal entry points remain real links instead of redirecting to the homepage",()=>{
 for(const href of ["/portal","/portal/staff","/portal/reception","/portal/admin"])
  assert.equal(safeCmsHref(href),href);
});
test("public informational routes and safe HTTPS links continue to work",()=>{
 for(const href of ["/","/membership","/contact","/events","/pages/careers","https://example.com/learn"])
  assert.equal(safeCmsHref(href),href);
});
test("private tools and dangerous schemes cannot be injected into editable navigation",()=>{
 for(const href of ["/staff","/staff-admin","/management-website-controls","/admin-workspace",
  "/reception-workspace","/portal/private-page","//example.com","javascript:alert(1)","data:text/html,hi"])
  assert.equal(safeCmsHref(href),"/");
});
test("Staff Portal buttons link straight to the working sign-in route",()=>{
 const source=readFileSync(new URL("../src/components/portal/SiteChrome.tsx",import.meta.url),"utf8");
 assert.ok(source.includes('label:"Staff Portal",href:"/portal/staff"'));
 assert.ok(source.includes("{label:'Staff Portal',to:'/portal/staff'}"));
});
