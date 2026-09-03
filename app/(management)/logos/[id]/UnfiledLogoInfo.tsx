"use client";

// The info page for a logo that belongs to no brand yet.
//
// `create_logo_with_presentation` (the top page's SVG upload) leaves
// subject_entity_id null, so such a logo has no /brands/[id]/... address and
// cannot be reached from the tree. It still has facts about it, so this route
// shows them in place rather than sending the visitor to the home page.

import LogoInfoPage from "@/app/brand/logos/[id]/page";

export default function UnfiledLogoInfo({ logoId }: { logoId: string }) {
  return <LogoInfoPage params={Promise.resolve({ id: logoId })} embedded />;
}
