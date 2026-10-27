/**
 * SIS brand mark.
 *
 * The official geometric S / ribbon monogram, copied verbatim from the
 * provided reference SVG (viewBox 0 0 512 512). Two filled crescent-arc
 * ribbons form the upper and lower halves of the S; each ribbon's outer
 * edge loops around one lobe while its inner edge returns along the
 * central diagonal connector.
 *
 * The reference's white background rect is omitted and the mark is drawn
 * in white so it blends straight into the blue gradient brand tiles.
 * The size prop scales the 512x512 artwork; the aspect ratio and all
 * coordinates are unchanged from the reference.
 */
export default function Logo({ size = 28, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 418 124
           C 386 61, 324 34, 258 39
           C 179 45, 124 104, 118 177
           C 113 224, 130 257, 161 294
           L 214 356
           C 228 373, 250 372, 263 357
           C 276 343, 272 324, 260 310
           L 211 252
           C 184 220, 174 191, 184 158
           C 198 111, 241 84, 291 83
           C 343 81, 387 96, 418 124 Z"
        fill="#ffffff"
      />
      <path
        d="M 94 387
           C 126 442, 188 469, 253 465
           C 330 460, 386 404, 394 331
           C 399 284, 382 251, 351 214
           L 298 151
           C 284 134, 262 135, 249 150
           C 236 164, 240 183, 252 197
           L 301 256
           C 328 288, 338 317, 328 350
           C 314 397, 271 424, 221 425
           C 169 427, 125 412, 94 387 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
