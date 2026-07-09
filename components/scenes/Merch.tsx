import { svgToDataUri } from "@/lib/svg";
import { luminance } from "@/lib/color";
import { Caption, type SceneProps } from "./shared";

// Chest print area on public/mockups/tshirt-white.jpg (3:2, shirt centered on hanger).
const PRINT = { left: 41.5, top: 36, width: 16 };

export default function Merch({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  // Very light logos would vanish in a multiply blend on white fabric.
  const printSvg = luminance(primary) > 0.85 ? variants.black : logo.svg;

  return (
    <section className="bg-background px-6 py-16 md:px-12">
      <Caption n="08" title="Merch" />
      <div className="relative mt-8 overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mockups/tshirt-white.jpg"
          alt={`${name} logo printed on a white t-shirt`}
          className="w-full"
        />
        <div
          className="absolute"
          style={{
            left: `${PRINT.left}%`,
            top: `${PRINT.top}%`,
            width: `${PRINT.width}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={svgToDataUri(printSvg)}
            alt=""
            className="w-full mix-blend-multiply opacity-90"
          />
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase text-white/40">
        Center chest print — multiply composite
      </p>
    </section>
  );
}
