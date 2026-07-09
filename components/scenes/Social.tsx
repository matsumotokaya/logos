import { svgToDataUri } from "@/lib/svg";
import { isDark } from "@/lib/color";
import { Caption, slugify, type SceneProps } from "./shared";

export default function Social({ logo, name, variants }: SceneProps) {
  const primary = logo.colors[0].hex;
  const slug = slugify(name);
  const logoOnPrimary = isDark(primary) ? variants.white : variants.black;

  return (
    <section className="flex min-h-[80vh] flex-col bg-black px-6 py-16 md:px-12">
      <Caption n="06" title="Social" />
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-[#101114] ring-1 ring-white/10">
          {/* Banner */}
          <div className="h-36" style={{ background: primary }} />
          <div className="px-6 pb-8">
            <div className="flex">
              <div
                className="-mt-12 flex size-24 items-center justify-center rounded-full ring-4 ring-[#101114]"
                style={{ background: primary }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={svgToDataUri(logoOnPrimary)}
                  alt=""
                  className="max-h-[50%] w-1/2 object-contain"
                />
              </div>
              <div
                className="ml-auto mt-3 self-start rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
                aria-hidden
              >
                Following
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5">
              <p className="text-xl font-semibold">{name}</p>
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <circle cx="10" cy="10" r="10" fill="#4B9BFF" />
                <path
                  d="M5.8 10.4l2.6 2.6 5.8-5.8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm text-white/50">@{slug}</p>
            <p className="mt-3 text-sm text-white/80">
              Official account. One logo, every asset.
            </p>
            <div className="mt-4 flex gap-6 text-sm">
              <span>
                <b className="font-semibold tabular-nums">35</b>{" "}
                <span className="text-white/50">Following</span>
              </span>
              <span>
                <b className="font-semibold tabular-nums">210K</b>{" "}
                <span className="text-white/50">Followers</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
