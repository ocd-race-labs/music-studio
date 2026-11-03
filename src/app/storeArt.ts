// Drawings of the instruments for the store: one <symbol> each, drawn once per page and used by id.

export const STORE_DEFS = `<defs>
<linearGradient id="g-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D98A3D"></stop><stop offset="0.55" stop-color="#A65A1F"></stop><stop offset="1" stop-color="#6B3410"></stop></linearGradient>
<linearGradient id="g-spruce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D7A2"></stop><stop offset="1" stop-color="#C98E48"></stop></linearGradient>
<linearGradient id="g-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBE6A0"></stop><stop offset="0.45" stop-color="#E0B54E"></stop><stop offset="1" stop-color="#9C6E1A"></stop></linearGradient>
<linearGradient id="g-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="0.5" stop-color="#C9CDD3"></stop><stop offset="1" stop-color="#7E848C"></stop></linearGradient>
<linearGradient id="g-lacquer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4A52"></stop><stop offset="0.3" stop-color="#1C1C21"></stop><stop offset="1" stop-color="#08080A"></stop></linearGradient>
<linearGradient id="g-burst" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F06A3C"></stop><stop offset="0.6" stop-color="#C02E1A"></stop><stop offset="1" stop-color="#5E120A"></stop></linearGradient>
<linearGradient id="g-shell" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6E1712"></stop><stop offset="0.5" stop-color="#C23A2C"></stop><stop offset="1" stop-color="#6E1712"></stop></linearGradient>
<linearGradient id="g-panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3A42"></stop><stop offset="1" stop-color="#1A1A1F"></stop></linearGradient>

<symbol id="i-violin" viewBox="0 0 60 200">
<circle cx="30" cy="9" r="6.5" fill="#5A2A0C"></circle><circle cx="30" cy="9" r="2.5" fill="#2A1206"></circle>
<rect x="26.5" y="13" width="7" height="20" rx="2" fill="#5A2A0C"></rect>
<path d="M30 68C42 68 52 74 52 88C52 100 44 106 44 116C44 124 56 130 56 154C56 176 44 190 30 190C16 190 4 176 4 154C4 130 16 124 16 116C16 106 8 100 8 88C8 74 18 68 30 68Z" fill="url(#g-wood)" stroke="#3A1806" stroke-width="1.5"></path>
<ellipse cx="21" cy="150" rx="7" ry="20" fill="#FFFFFF" opacity="0.09"></ellipse>
<rect x="26.5" y="30" width="7" height="100" rx="3" fill="#17110E"></rect>
<path d="M19 128c-3 6 3 18 0 24M41 128c3 6-3 18 0 24" stroke="#2A1206" stroke-width="2" fill="none" stroke-linecap="round"></path>
<rect x="20" y="146" width="20" height="3" rx="1" fill="#EBD3A0"></rect>
<path d="M25 160h10l-2 24h-6z" fill="#17110E"></path>
<path d="M28.3 30v130M29.4 30v116M30.6 30v116M31.7 30v130" stroke="#EDE6D8" stroke-width="0.45"></path>
</symbol>

<symbol id="i-cello" viewBox="0 0 60 220">
<use href="#i-violin" x="0" y="0" width="60" height="200"></use>
<path d="M30 190v28" stroke="#9AA0A6" stroke-width="2.4" stroke-linecap="round"></path>
</symbol>

<symbol id="i-section" viewBox="0 0 150 200">
<use href="#i-violin" x="0" y="20" width="54" height="180"></use>
<use href="#i-violin" x="96" y="20" width="54" height="180"></use>
<use href="#i-violin" x="45" y="0" width="60" height="200"></use>
</symbol>

<symbol id="i-guitar" viewBox="0 0 80 220">
<rect x="32" y="2" width="16" height="28" rx="4" fill="#4A2A12"></rect>
<circle cx="29" cy="9" r="2.5" fill="#E7E2D6"></circle><circle cx="29" cy="17" r="2.5" fill="#E7E2D6"></circle><circle cx="29" cy="25" r="2.5" fill="#E7E2D6"></circle><circle cx="51" cy="9" r="2.5" fill="#E7E2D6"></circle><circle cx="51" cy="17" r="2.5" fill="#E7E2D6"></circle><circle cx="51" cy="25" r="2.5" fill="#E7E2D6"></circle>
<rect x="35" y="28" width="10" height="72" fill="#3A2414"></rect>
<path d="M40 96C56 96 64 104 64 118C64 128 58 132 58 140C58 148 76 156 76 180C76 204 60 216 40 216C20 216 4 204 4 180C4 156 22 148 22 140C22 132 16 128 16 118C16 104 24 96 40 96Z" fill="url(#g-spruce)" stroke="#6B3A16" stroke-width="2.5"></path>
<rect x="35" y="96" width="10" height="44" fill="#2A1A10"></rect>
<circle cx="40" cy="152" r="15" fill="none" stroke="#8A5A2B" stroke-width="3" stroke-dasharray="2 1.5"></circle>
<circle cx="40" cy="152" r="11" fill="#1A0F08"></circle>
<rect x="27" y="186" width="26" height="6" rx="2" fill="#3A2414"></rect>
<path d="M37 6v183M39 6v183M41 6v183M43 6v183" stroke="#F5EFE2" stroke-width="0.5"></path>
</symbol>

<symbol id="i-eguitar" viewBox="0 0 90 220">
<path d="M38 2h16l-2 30h-12z" fill="#2A2A2E"></path>
<rect x="40" y="30" width="10" height="92" fill="#E4C07E"></rect>
<path d="M40 40h10M40 52h10M40 64h10M40 76h10M40 88h10M40 100h10M40 112h10" stroke="#B08A4A" stroke-width="1"></path>
<path d="M30 120C14 118 6 132 10 150C12 160 4 168 6 186C8 206 26 216 46 214C70 212 84 198 82 176C80 162 70 160 72 148C74 132 86 122 76 110C70 104 60 108 56 118C50 124 42 122 30 120Z" fill="url(#g-burst)" stroke="#3A0A04" stroke-width="1.5"></path>
<path d="M26 150C34 140 52 140 58 150L60 196C48 204 32 202 24 192Z" fill="#F4EFE6" opacity="0.92"></path>
<rect x="36" y="146" width="18" height="7" rx="2" fill="#16161A"></rect><rect x="36" y="166" width="18" height="7" rx="2" fill="#16161A"></rect>
<rect x="34" y="186" width="22" height="4" rx="1" fill="#C9CDD3"></rect>
<circle cx="68" cy="190" r="3.5" fill="#E8E8EC"></circle><circle cx="72" cy="178" r="3.5" fill="#E8E8EC"></circle>
<path d="M42 6v182M44 6v182M46 6v182M48 6v182" stroke="#F5EFE2" stroke-width="0.45"></path>
</symbol>

<symbol id="i-flute" viewBox="0 0 240 34">
<rect x="4" y="12" width="232" height="10" rx="5" fill="url(#g-silver)" stroke="#6E747C" stroke-width="0.8"></rect>
<ellipse cx="28" cy="12" rx="8" ry="4" fill="url(#g-silver)" stroke="#6E747C" stroke-width="0.8"></ellipse>
<path d="M62 12v10M170 12v10" stroke="#6E747C" stroke-width="1"></path>
<circle cx="84" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="100" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="116" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="138" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="154" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="194" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle><circle cx="212" cy="17" r="3.6" fill="#E9ECF0" stroke="#6E747C" stroke-width="0.8"></circle>
</symbol>

<symbol id="i-trumpet" viewBox="0 0 200 92">
<rect x="2" y="40" width="12" height="7" rx="2" fill="url(#g-silver)"></rect>
<rect x="12" y="41" width="100" height="5" fill="url(#g-brass)"></rect>
<rect x="38" y="50" width="78" height="26" rx="13" fill="none" stroke="url(#g-brass)" stroke-width="5"></rect>
<path d="M108 40C150 40 176 30 196 6L196 86C176 62 150 50 108 50Z" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="1"></path>
<ellipse cx="196" cy="46" rx="4" ry="40" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></ellipse>
<rect x="60" y="22" width="9" height="46" rx="2" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="0.8"></rect><rect x="73" y="22" width="9" height="46" rx="2" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="0.8"></rect><rect x="86" y="22" width="9" height="46" rx="2" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="0.8"></rect>
<rect x="58" y="16" width="13" height="6" rx="3" fill="#F7F1DE"></rect><rect x="71" y="16" width="13" height="6" rx="3" fill="#F7F1DE"></rect><rect x="84" y="16" width="13" height="6" rx="3" fill="#F7F1DE"></rect>
</symbol>

<symbol id="i-tmute" viewBox="0 0 210 92">
<use href="#i-trumpet" x="0" y="0" width="200" height="92"></use>
<path d="M168 30L206 18L206 74L168 62Z" fill="#3A2A1E" stroke="#1A120C" stroke-width="1"></path>
<ellipse cx="206" cy="46" rx="4" ry="28" fill="#5A4636"></ellipse>
</symbol>

<symbol id="i-horn" viewBox="0 0 170 160">
<circle cx="70" cy="84" r="52" fill="none" stroke="url(#g-brass)" stroke-width="9"></circle>
<circle cx="70" cy="84" r="34" fill="none" stroke="url(#g-brass)" stroke-width="6"></circle>
<path d="M104 112C126 112 144 126 158 152L110 158C112 140 106 126 96 120Z" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="1"></path>
<ellipse cx="134" cy="155" rx="25" ry="4" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></ellipse>
<rect x="56" y="40" width="8" height="22" rx="2" fill="url(#g-brass)"></rect><rect x="68" y="40" width="8" height="22" rx="2" fill="url(#g-brass)"></rect><rect x="80" y="40" width="8" height="22" rx="2" fill="url(#g-brass)"></rect>
<path d="M30 60L8 48" stroke="url(#g-silver)" stroke-width="4" stroke-linecap="round"></path>
</symbol>

<symbol id="i-sax" viewBox="0 0 110 220">
<path d="M14 18C24 6 46 4 54 22" stroke="url(#g-brass)" stroke-width="7" fill="none" stroke-linecap="round"></path>
<rect x="8" y="14" width="10" height="8" rx="2" fill="#17110E" transform="rotate(-40 13 18)"></rect>
<path d="M48 20L60 20L66 150C68 178 78 190 90 184L94 160L108 164C108 196 88 214 66 210C44 206 40 180 42 150Z" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="1.2"></path>
<ellipse cx="101" cy="162" rx="8" ry="4" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></ellipse>
<circle cx="56" cy="52" r="4" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle><circle cx="57" cy="70" r="4" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle><circle cx="58" cy="88" r="4" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle><circle cx="59" cy="110" r="4.5" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle><circle cx="60" cy="130" r="4.5" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle><circle cx="62" cy="150" r="5" fill="#FCE9A8" stroke="#8A5E12" stroke-width="1"></circle>
<ellipse cx="54" cy="176" rx="5" ry="9" fill="#FFFFFF" opacity="0.15"></ellipse>
</symbol>

<symbol id="i-piano" viewBox="0 0 240 150">
<path d="M14 72L196 8L203 15L36 72Z" fill="url(#g-lacquer)" stroke="#000" stroke-width="1"></path>
<path d="M120 40L126 72" stroke="#7E848C" stroke-width="2"></path>
<path d="M8 72L172 72C204 72 232 78 232 94L232 104L8 104Z" fill="url(#g-lacquer)" stroke="#000" stroke-width="1"></path>
<path d="M10 75H170" stroke="#6A6A72" stroke-width="1.2"></path>
<rect x="2" y="78" width="48" height="11" fill="#F6F1E6" stroke="#1A1A1A" stroke-width="0.8"></rect>
<path d="M8 78v6M14 78v6M22 78v6M28 78v6M34 78v6M42 78v6" stroke="#111" stroke-width="2.4"></path>
<rect x="18" y="104" width="9" height="40" fill="url(#g-lacquer)"></rect><rect x="206" y="104" width="9" height="40" fill="url(#g-lacquer)"></rect><rect x="120" y="104" width="8" height="34" fill="url(#g-lacquer)"></rect>
<rect x="16" y="142" width="13" height="5" rx="2" fill="#C9A24A"></rect><rect x="204" y="142" width="13" height="5" rx="2" fill="#C9A24A"></rect>
</symbol>

<symbol id="i-vibes" viewBox="0 0 230 140">
<path d="M10 62H220" stroke="#5A5A62" stroke-width="4"></path>
<rect x="14" y="20" width="18" height="44" rx="3" fill="url(#g-silver)"></rect><rect x="38" y="24" width="18" height="40" rx="3" fill="url(#g-silver)"></rect><rect x="62" y="28" width="18" height="36" rx="3" fill="url(#g-silver)"></rect><rect x="86" y="32" width="18" height="32" rx="3" fill="url(#g-silver)"></rect><rect x="110" y="35" width="18" height="29" rx="3" fill="url(#g-silver)"></rect><rect x="134" y="38" width="18" height="26" rx="3" fill="url(#g-silver)"></rect><rect x="158" y="41" width="18" height="23" rx="3" fill="url(#g-silver)"></rect><rect x="182" y="44" width="18" height="20" rx="3" fill="url(#g-silver)"></rect>
<rect x="19" y="66" width="8" height="46" fill="#B8BDC4"></rect><rect x="43" y="66" width="8" height="40" fill="#B8BDC4"></rect><rect x="67" y="66" width="8" height="35" fill="#B8BDC4"></rect><rect x="91" y="66" width="8" height="30" fill="#B8BDC4"></rect><rect x="115" y="66" width="8" height="26" fill="#B8BDC4"></rect><rect x="139" y="66" width="8" height="22" fill="#B8BDC4"></rect><rect x="163" y="66" width="8" height="19" fill="#B8BDC4"></rect><rect x="187" y="66" width="8" height="16" fill="#B8BDC4"></rect>
<path d="M14 66L22 132M214 66L206 132" stroke="#3A3A42" stroke-width="4"></path>
<circle cx="22" cy="134" r="4" fill="#222"></circle><circle cx="206" cy="134" r="4" fill="#222"></circle>
<path d="M92 6L120 30M100 4L132 32" stroke="#9A7A4A" stroke-width="2"></path><circle cx="120" cy="30" r="4" fill="#C9C0F0"></circle><circle cx="132" cy="32" r="4" fill="#C9C0F0"></circle>
</symbol>

<symbol id="i-drums" viewBox="0 0 230 170">
<path d="M30 40L30 150M200 30L200 150" stroke="#9AA0A6" stroke-width="2.5"></path>
<ellipse cx="30" cy="40" rx="26" ry="4" fill="url(#g-brass)"></ellipse>
<ellipse cx="200" cy="30" rx="30" ry="5" fill="url(#g-brass)"></ellipse>
<path d="M80 74h36v22H80z" fill="url(#g-shell)"></path><ellipse cx="98" cy="74" rx="18" ry="5" fill="#F1ECE2"></ellipse>
<path d="M126 70h40v26h-40z" fill="url(#g-shell)"></path><ellipse cx="146" cy="70" rx="20" ry="5.5" fill="#F1ECE2"></ellipse>
<circle cx="122" cy="122" r="42" fill="#F1ECE2" stroke="url(#g-shell)" stroke-width="9"></circle>
<circle cx="122" cy="122" r="16" fill="#E2D9C8"></circle>
<path d="M40 108h40v20H40z" fill="#C9CDD3"></path><ellipse cx="60" cy="108" rx="20" ry="5" fill="#F1ECE2"></ellipse>
<path d="M60 128L52 160M60 128L68 160" stroke="#9AA0A6" stroke-width="2"></path>
</symbol>

<symbol id="i-congas" viewBox="0 0 150 190">
<path d="M14 34C8 84 16 144 26 182H62C72 144 80 84 74 34Z" fill="url(#g-wood)" stroke="#3A1806" stroke-width="1.2"></path>
<ellipse cx="44" cy="34" rx="30" ry="7" fill="#F1E6CC" stroke="#9AA0A6" stroke-width="2"></ellipse>
<path d="M12 70H76M14 130H74" stroke="#C9CDD3" stroke-width="2.5"></path>
<path d="M80 54C76 98 82 146 90 182H124C132 146 138 98 134 54Z" fill="url(#g-wood)" stroke="#3A1806" stroke-width="1.2"></path>
<ellipse cx="107" cy="54" rx="27" ry="6" fill="#F1E6CC" stroke="#9AA0A6" stroke-width="2"></ellipse>
<path d="M78 90H136M80 144H132" stroke="#C9CDD3" stroke-width="2.5"></path>
</symbol>

<symbol id="i-synth" viewBox="0 0 240 92">
<rect x="2" y="10" width="236" height="78" rx="6" fill="url(#g-panel)" stroke="#000" stroke-width="1"></rect>
<rect x="2" y="10" width="10" height="78" rx="3" fill="url(#g-wood)"></rect><rect x="228" y="10" width="10" height="78" rx="3" fill="url(#g-wood)"></rect>
<rect x="20" y="18" width="40" height="16" rx="2" fill="#0B2A2E"></rect><path d="M24 30c4-10 8 10 12 0s8 10 12 0 6 6 8 2" stroke="#3BE0F0" stroke-width="1.5" fill="none"></path>
<circle cx="76" cy="26" r="6" fill="#F2661C"></circle><circle cx="96" cy="26" r="6" fill="#E8E8EC"></circle><circle cx="116" cy="26" r="6" fill="#E8E8EC"></circle><circle cx="136" cy="26" r="6" fill="#3BE0F0"></circle><circle cx="156" cy="26" r="6" fill="#E8E8EC"></circle><circle cx="176" cy="26" r="6" fill="#E8E8EC"></circle><circle cx="200" cy="26" r="8" fill="#C9CDD3"></circle>
<rect x="14" y="44" width="212" height="40" fill="#F6F3EC"></rect>
<path d="M28 44v40M42 44v40M56 44v40M70 44v40M84 44v40M98 44v40M112 44v40M126 44v40M140 44v40M154 44v40M168 44v40M182 44v40M196 44v40M210 44v40" stroke="#B8B4AC" stroke-width="1"></path>
<path d="M24 44v24M38 44v24M66 44v24M80 44v24M94 44v24M122 44v24M136 44v24M164 44v24M178 44v24M192 44v24M220 44v24" stroke="#141416" stroke-width="7"></path>
</symbol>

<symbol id="i-machine" viewBox="0 0 170 130">
<rect x="2" y="4" width="166" height="122" rx="8" fill="url(#g-panel)" stroke="#000" stroke-width="1"></rect>
<rect x="12" y="12" width="60" height="18" rx="2" fill="#2A1608"></rect><path d="M16 22h20M40 22h8" stroke="#F2A23C" stroke-width="3"></path>
<circle cx="92" cy="21" r="7" fill="#C9CDD3"></circle><circle cx="114" cy="21" r="7" fill="#C9CDD3"></circle><circle cx="136" cy="21" r="7" fill="#C9CDD3"></circle><circle cx="156" cy="21" r="5" fill="#F2661C"></circle>
<rect x="12" y="40" width="34" height="18" rx="3" fill="#F2661C"></rect><rect x="50" y="40" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="88" y="40" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="126" y="40" width="34" height="18" rx="3" fill="#F2A23C"></rect>
<rect x="12" y="62" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="50" y="62" width="34" height="18" rx="3" fill="#F2661C"></rect><rect x="88" y="62" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="126" y="62" width="34" height="18" rx="3" fill="#E9E2D4"></rect>
<rect x="12" y="84" width="34" height="18" rx="3" fill="#F2A23C"></rect><rect x="50" y="84" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="88" y="84" width="34" height="18" rx="3" fill="#E9E2D4"></rect><rect x="126" y="84" width="34" height="18" rx="3" fill="#F2661C"></rect>
<path d="M14 112H158" stroke="#5A5A62" stroke-width="2" stroke-dasharray="6 4"></path>
</symbol>

<symbol id="i-timpani" viewBox="0 0 160 150">
<path d="M14 40C14 100 46 130 80 130C114 130 146 100 146 40Z" fill="url(#g-brass)" stroke="#8A5E12" stroke-width="1.2"></path>
<ellipse cx="80" cy="40" rx="66" ry="12" fill="#F1E6CC" stroke="#9AA0A6" stroke-width="3"></ellipse>
<path d="M36 112L26 148M124 112L134 148M80 130V148" stroke="#5A5A62" stroke-width="4"></path>
<ellipse cx="56" cy="78" rx="8" ry="20" fill="#FFFFFF" opacity="0.18"></ellipse>
</symbol>

<linearGradient id="g-blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5BA8F0"></stop><stop offset="0.6" stop-color="#1F5FB8"></stop><stop offset="1" stop-color="#0C2A5E"></stop></linearGradient>
<symbol id="i-ebass" viewBox="0 0 90 250">
<path d="M37 2h18l-2 30h-14z" fill="#2A2A2E"></path>
<circle cx="33" cy="10" r="3" fill="#C9CDD3"></circle><circle cx="33" cy="22" r="3" fill="#C9CDD3"></circle><circle cx="59" cy="10" r="3" fill="#C9CDD3"></circle><circle cx="59" cy="22" r="3" fill="#C9CDD3"></circle>
<rect x="40" y="30" width="11" height="122" fill="#3A2414"></rect>
<path d="M40 44h11M40 60h11M40 76h11M40 92h11M40 108h11M40 124h11M40 140h11" stroke="#B8BDC4" stroke-width="1"></path>
<path d="M30 150C14 148 6 162 10 180C12 190 4 198 6 216C8 236 26 246 46 244C70 242 84 228 82 206C80 192 70 190 72 178C74 162 86 152 76 140C70 134 60 138 56 148C50 154 42 152 30 150Z" fill="url(#g-blue)" stroke="#06142E" stroke-width="1.5"></path>
<path d="M24 182C32 172 52 172 58 182L58 222C46 230 32 228 24 220Z" fill="#111114" opacity="0.85"></path>
<rect x="34" y="184" width="24" height="8" rx="3" fill="#16161A" stroke="#3A3A42"></rect><rect x="34" y="204" width="24" height="8" rx="3" fill="#16161A" stroke="#3A3A42"></rect>
<rect x="36" y="222" width="20" height="5" rx="1" fill="#C9CDD3"></rect>
<path d="M42.5 6v218M45 6v218M47.5 6v218M50 6v218" stroke="#F5EFE2" stroke-width="0.55"></path>
</symbol>
<symbol id="i-mic" viewBox="0 0 80 210">
<rect x="26" y="4" width="28" height="44" rx="14" fill="url(#g-silver)" stroke="#5A5F66" stroke-width="1"></rect>
<path d="M28 18h24M27 26h26M27 34h26" stroke="#7E848C" stroke-width="1"></path>
<rect x="31" y="46" width="18" height="40" rx="4" fill="url(#g-lacquer)"></rect>
<path d="M40 86v100" stroke="#5A5A62" stroke-width="3"></path>
<ellipse cx="40" cy="194" rx="30" ry="7" fill="url(#g-lacquer)"></ellipse>
</symbol>
<symbol id="i-epiano" viewBox="0 0 240 130">
<rect x="4" y="20" width="232" height="40" rx="8" fill="url(#g-lacquer)" stroke="#000" stroke-width="1"></rect>
<rect x="4" y="20" width="232" height="6" rx="3" fill="#C9CDD3"></rect>
<rect x="14" y="44" width="212" height="22" fill="#F6F3EC"></rect>
<path d="M28 44v22M42 44v22M56 44v22M70 44v22M84 44v22M98 44v22M112 44v22M126 44v22M140 44v22M154 44v22M168 44v22M182 44v22M196 44v22M210 44v22" stroke="#B8B4AC" stroke-width="1"></path>
<path d="M24 44v13M38 44v13M66 44v13M80 44v13M94 44v13M122 44v13M136 44v13M164 44v13M178 44v13M192 44v13M220 44v13" stroke="#141416" stroke-width="7"></path>
<circle cx="30" cy="33" r="3" fill="#F2661C"></circle><circle cx="44" cy="33" r="3" fill="#E8E8EC"></circle>
<path d="M24 66L18 126M216 66L222 126" stroke="#2A2A2E" stroke-width="5"></path>
</symbol>
<symbol id="i-organ" viewBox="0 0 240 150">
<path d="M10 30H230V140H10Z" fill="url(#g-wood)" stroke="#3A1806" stroke-width="1.2"></path>
<rect x="18" y="18" width="204" height="18" rx="2" fill="#5A2A0C"></rect>
<rect x="30" y="20" width="8" height="12" fill="#F2F2F2"></rect><rect x="42" y="20" width="8" height="12" fill="#3A3A42"></rect><rect x="54" y="20" width="8" height="12" fill="#F2F2F2"></rect><rect x="66" y="20" width="8" height="12" fill="#C02E1A"></rect><rect x="78" y="20" width="8" height="12" fill="#F2F2F2"></rect><rect x="90" y="20" width="8" height="12" fill="#3A3A42"></rect>
<rect x="18" y="44" width="204" height="18" fill="#F6F3EC"></rect><rect x="18" y="68" width="204" height="18" fill="#F6F3EC"></rect>
<path d="M28 44v18M38 44v18M48 44v18M58 44v18M68 44v18M78 44v18M88 44v18M98 44v18M108 44v18M118 44v18M128 44v18M138 44v18M148 44v18M158 44v18M168 44v18M178 44v18M188 44v18M198 44v18M208 44v18M28 68v18M38 68v18M48 68v18M58 68v18M68 68v18M78 68v18M88 68v18M98 68v18M108 68v18M118 68v18M128 68v18M138 68v18M148 68v18M158 68v18M168 68v18M178 68v18M188 68v18M198 68v18M208 68v18" stroke="#B8B4AC" stroke-width="1"></path>
<path d="M25 44v11M35 44v11M55 44v11M65 44v11M75 44v11M95 44v11M105 44v11M125 44v11M135 44v11M145 44v11M165 44v11M175 44v11M195 44v11M205 44v11M25 68v11M35 68v11M55 68v11M65 68v11M75 68v11M95 68v11M105 68v11M125 68v11M135 68v11M145 68v11M165 68v11M175 68v11M195 68v11M205 68v11" stroke="#141416" stroke-width="5"></path>
<rect x="60" y="120" width="120" height="10" rx="2" fill="#3A1806"></rect>
</symbol>
</defs>`;

export const ART_VIEWBOX = {
  'i-violin': '0 0 60 200',
  'i-cello': '0 0 60 220',
  'i-section': '0 0 150 200',
  'i-guitar': '0 0 80 220',
  'i-eguitar': '0 0 90 220',
  'i-flute': '0 0 240 34',
  'i-trumpet': '0 0 200 92',
  'i-tmute': '0 0 210 92',
  'i-horn': '0 0 170 160',
  'i-sax': '0 0 110 220',
  'i-piano': '0 0 240 150',
  'i-vibes': '0 0 230 140',
  'i-drums': '0 0 230 170',
  'i-congas': '0 0 150 190',
  'i-synth': '0 0 240 92',
  'i-machine': '0 0 170 130',
  'i-timpani': '0 0 160 150',
  'i-ebass': '0 0 90 250',
  'i-mic': '0 0 80 210',
  'i-epiano': '0 0 240 130',
  'i-organ': '0 0 240 150',
} as const;
export type ArtId = keyof typeof ART_VIEWBOX;
