// Language layer. Modes:
//   titles (names) and explanations (UI text) each in Portuguese or English, chosen separately
//   "pt"      -> everything in Portuguese
//   "en"      -> everything in English
// Entries are [portuguese, english, kind]; kind "n" = name, "u" = UI text / explanation.
// tr() accepts either language and returns the text for the current mode. A MutationObserver
// translates exact-match text nodes and title/placeholder attributes as the UI renders.
(function () {
  "use strict";
  const N = "n", U = "u";
  const E = [
    // ---- sections and categories
    ["Transições", "Transitions", N], ["Texto", "Text", N], ["Loops", "Loops", N],
    ["Fade", "Fade", N], ["Slide", "Slide", N], ["Fora da Tela", "Off-screen", N], ["Escala", "Scale", N], ["Rotação", "Rotation", N],
    ["Blur", "Blur", N], ["3D", "3D", N], ["Wipe", "Wipe", N], ["Elástico", "Elastic", N], ["Shapes", "Shapes", N], ["Luz", "Light", N],
    ["Glitch", "Glitch", N], ["Combinados", "Combos", N], ["Letras", "Characters", N], ["Palavras", "Words", N], ["Linhas", "Lines", N],
    ["Texto Inteiro", "Whole Text", N], ["Digitação", "Typewriter", N], ["Movimento", "Motion", N], ["Opacidade", "Opacity", U],
    ["Favoritos", "Favorites", U], ["Todas", "All", U], ["Todas de transições", "All transitions", U], ["Todas de texto", "All text", U], ["Todas de loops", "All loops", U],
    ["Todas as animações", "All animations", U],
    // ---- transitions
    ["Fade", "Fade", N], ["Fade Suave", "Soft Fade", N], ["Fade Up", "Fade Up", N], ["Fade Down", "Fade Down", N], ["Fade Scale", "Fade Scale", N],
    ["Slide ←", "Slide ←", N], ["Slide →", "Slide →", N], ["Slide ↑", "Slide ↑", N], ["Slide ↓", "Slide ↓", N],
    ["Da Esquerda", "From Left", N], ["Da Direita", "From Right", N], ["De Cima", "From Top", N], ["De Baixo", "From Bottom", N],
    ["Aumentar Escala", "Scale Up", N], ["Reduzir Escala", "Scale Down", N], ["Zoom Forte", "Strong Zoom", N], ["Pop", "Pop", N],
    ["Abrir Horizontal", "Open Horizontal", N], ["Abrir Vertical", "Open Vertical", N], ["Girar Entrando", "Rotate In", N],
    ["Girar Horário", "Rotate Clockwise", N], ["Giro", "Spin", N], ["Giro 360", "Spin 360", N], ["Rolar ←", "Roll ←", N], ["Inclinar", "Tilt", N],
    ["Desfoque Entrando", "Blur In", N], ["Zoom com Desfoque", "Zoom Blur", N], ["Deslizar com Desfoque ←", "Blur Slide ←", N], ["Deslizar com Desfoque ↑", "Blur Slide ↑", N],
    ["Escala com Desfoque", "Blur Scale", N], ["Virar X", "Flip X", N], ["Virar Y", "Flip Y", N], ["Virar para Cima", "Flip Up", N], ["Porta", "Door Swing", N],
    ["Giro 3D", "3D Turn", N], ["Wipe →", "Wipe →", N], ["Wipe ←", "Wipe ←", N], ["Wipe ↓", "Wipe ↓", N], ["Wipe ↑", "Wipe ↑", N],
    ["Wipe Diagonal", "Diagonal Wipe", N], ["Wipe Radial", "Radial Wipe", N], ["Persiana", "Venetian Blinds", N], ["Blocos", "Block Dissolve", N],
    ["Queda Quicando", "Bounce Drop", N], ["Subida Quicando", "Bounce Rise", N], ["Elástico →", "Elastic →", N], ["Gelatina", "Jelly", N], ["Pop Giro", "Pop Spin", N],
    ["Íris", "Iris", N], ["Íris + Escala", "Iris + Scale", N], ["Losango", "Diamond", N], ["Caixa", "Box", N], ["Cortina ↔", "Curtain ↔", N], ["Cortina ↕", "Curtain ↕", N],
    ["Flash de Luz", "Light Flash", N], ["Superexposição", "Overexpose", N], ["Queima de Luz", "Light Burn", N], ["Glitch Deslizante", "Glitch Slide", N],
    ["Glitch Blocos", "Glitch Blocks", N], ["Entrada Z (do fundo)", "Z In (from back)", N], ["Entrada Z (da frente)", "Z In (from front)", N], ["Giro Y 360", "Y Spin 360", N],
    ["Subir + Blur", "Rise + Blur", N], ["Giro + Blur", "Spin + Blur", N], ["Zoom + Giro", "Zoom + Spin", N], ["Slide + Wipe", "Slide + Wipe", N], ["Flip + Blur", "Flip + Blur", N],
    // names that are English in presets.js but need a Portuguese form
    ["Aumentar Escala", "Scale Up", N], ["Reduzir Escala", "Scale Down", N], ["Girar Entrando", "Rotate In", N], ["Giro", "Spin", N], ["Giro 360", "Spin 360", N],
    ["Desfoque Entrando", "Blur In", N], ["Zoom com Desfoque", "Zoom Blur", N], ["Deslizar com Desfoque ←", "Blur Slide ←", N], ["Deslizar com Desfoque ↑", "Blur Slide ↑", N],
    ["Escala com Desfoque", "Blur Scale", N], ["Virar X", "Flip X", N], ["Virar Y", "Flip Y", N], ["Virar para Cima", "Flip Up", N],
    // ---- text
    ["Fade Letras", "Fade Characters", N], ["Subir Letras", "Rise Characters", N], ["Descer Letras", "Drop Characters", N], ["Deslizar Letras", "Slide Characters", N],
    ["Escala Letras", "Scale Characters", N], ["Zoom Letras", "Zoom Characters", N], ["Blur Letras", "Blur Characters", N], ["Girar Letras", "Rotate Characters", N],
    ["Inclinar Letras", "Skew Characters", N], ["Letras Aleatórias", "Random Characters", N], ["Blur Aleatório", "Random Blur", N],
    ["Fade Palavras", "Fade Words", N], ["Subir Palavras", "Rise Words", N], ["Deslizar Palavras", "Slide Words", N], ["Escala Palavras", "Scale Words", N],
    ["Blur Palavras", "Blur Words", N], ["Palavras Aleatórias", "Random Words", N], ["Fade Linhas", "Fade Lines", N], ["Subir Linhas", "Rise Lines", N],
    ["Deslizar Linhas", "Slide Lines", N], ["Blur Linhas", "Blur Lines", N], ["Espaçamento Abrir", "Tracking Open", N], ["Espaçamento Fechar", "Tracking Close", N],
    ["Blur Texto", "Blur Text", N], ["Subir Texto", "Rise Text", N], ["Máquina de Escrever", "Typewriter", N], ["Palavra por Palavra", "Word by Word", N],
    ["Linha por Linha", "Line by Line", N], ["Snap Elástico", "Elastic Snap", N], ["Escala Elástica", "Elastic Scale", N], ["Pulo Elástico", "Elastic Jump", N],
    ["Zoom Elástico", "Elastic Zoom", N], ["Giro Elástico", "Elastic Spin", N], ["Inclinação Elástica", "Elastic Skew", N], ["Cair Letras", "Falling Characters", N],
    ["Espalhar", "Scatter", N], ["Blur + Escala", "Blur + Scale", N], ["Subir Aleatório", "Random Rise", N], ["Cair Palavras", "Falling Words", N],
    ["Zoom Palavras", "Zoom Words", N], ["Zoom Linhas", "Zoom Lines", N], ["Zoom Texto", "Zoom Text", N],
    // ---- loops
    ["Wiggle", "Wiggle", N], ["Tremor", "Shake", N], ["Flutuar", "Float", N], ["Órbita", "Orbit", N], ["Pulsar", "Pulse", N], ["Batida", "Heartbeat", N],
    ["Wiggle Escala", "Wiggle Scale", N], ["Girar", "Spin", N], ["Balançar", "Swing", N], ["Wiggle Rotação", "Wiggle Rotation", N], ["Piscar", "Blink", N],
    ["Respirar", "Breathe", N], ["Cintilar", "Flicker", N], ["Quique", "Bounce", N], ["Quique com Balanço", "Bounce + Sway", N], ["Balanço Lateral", "Side Sway", N],
    ["Movimento Constante", "Constant Drift", N], ["Onda Gira e Escala", "Wave Spin + Scale", N],
    // ---- tools, effects and templates (names)
    ["Glow físico (Cinemático)", "Physical Glow (Cinematic)", N], ["Glow contínuo", "Continuous Glitch", N], ["Glitch contínuo", "Continuous Glitch", N],
    ["Turbulência", "Turbulence", N], ["Chroma key", "Chroma Key", N], ["Inverter keys", "Reverse Keys", N], ["Easy Ease", "Easy Ease", N],
    ["Ativar 3D", "Toggle 3D", N], ["Ativar / desativar 3D", "Toggle 3D", N], ["Motion blur", "Motion Blur", N], ["Null controlador", "Null Controller", N],
    ["Centralizar âncora", "Center Anchor", N], ["Encaixar na comp", "Fit to Comp", N], ["Esteira infinita", "Infinite Scroll", N], ["Vídeo infinito", "Infinite Video", N],
    ["Marcar batidas", "Mark Beats", N], ["Reagir à batida", "Beat React", N], ["Fade de áudio", "Audio Fade", N], ["Fade final", "Fade to Black", N],
    ["Organizar camadas", "Organize Layers", N], ["Vinheta", "Vignette", N], ["Grão", "Grain", N], ["Letterbox 2.39", "Letterbox 2.39", N], ["Letterbox", "Letterbox", N],
    ["Limpar cache", "Purge Cache", N], ["Light Sweep", "Light Sweep", N], ["Light leak", "Light Leak", N], ["Flash", "Flash", N], ["Stories ↔ Feed", "Stories ↔ Feed", N],
    ["Dolly zoom", "Dolly Zoom", N], ["Câmera na mão", "Handheld Camera", N], ["Tremida de impacto", "Impact Shake", N], ["Entrada pelo fundo", "Fly-in from Back", N],
    ["Final de fuga", "Escape Pull-out", N], ["Revelação lateral", "Side Reveal", N], ["Zoom na batida", "Zoom on Beat", N], ["Foco na layer", "Focus on Layer", N],
    ["Rack focus", "Rack Focus", N], ["Lower third", "Lower Third", N], ["Título central", "Center Title", N], ["Contagem", "Countdown", N],
    ["Contador progressivo", "Progressive Counter", N], ["Contador numérico", "Number Counter", N], ["Criar contador", "Create counter", U],
    ["Preencher", "Fill", N], ["Tint", "Tint", N], ["Gradiente", "Gradient Ramp", N], ["Espelho", "Mirror", N], ["Sombra", "Drop Shadow", N],
    ["Curvas", "Curves", N], ["Lumetri", "Lumetri", N], ["Contorno", "Stroke", N], ["Ruído", "Noise", N], ["Nitidez", "Sharpen", N], ["Remover FX", "Remove FX", N],
    ["Suave", "Soft", N], ["Cinemático", "Cinematic", N], ["Neon", "Neon", N], ["Sol", "Sun", N], ["Fogo", "Fire", N], ["Anamórfico", "Anamorphic", N],
    ["Carrossel 3D", "3D Carousel", N], ["Órbita 2D", "2D Orbit", N],
    // ---- tool tabs and sections (UI)
    ["Navegar", "Browse", U], ["Montar", "Build", U], ["Editar", "Edit", N], ["Ferramentas", "Tools", N], ["Atalhos", "Shortcuts", N],
    ["Câmera", "Camera", N], ["Modelos", "Templates", N], ["Fontes", "Fonts", N], ["Shape", "Shape", N], ["Efeitos", "Effects", N],
    ["Expressões", "Expressions", N], ["Carrossel", "Carousel", N], ["Workflow", "Workflow", N],
    ["Movimentos", "Moves", N], ["Parallax", "Parallax", U], ["Foco", "Focus", U], ["FX Câmera", "Camera FX", U],
    ["Modelos prontos", "Ready-made templates", N], ["Overlays", "Overlays", N], ["Alinhar", "Align", N], ["Alinhar e distribuir", "Align and distribute", N], ["Âncora", "Anchor", N],
    ["Precomp e projeto", "Precomp & project", N], ["Criar layer", "Create layer", N], ["Efeitos rápidos", "Quick effects", N], ["Layers", "Layers", U],
    ["Área de transferência de propriedades", "Property clipboard", U], ["Repetir keyframes (loopOut)", "Repeat keyframes (loopOut)", N],
    ["Editor de curva", "Curve editor", N], ["Minhas curvas", "My curves", N], ["Fontes usadas", "Fonts in use", N], ["Trocar por", "Replace with", N],
    ["Aparência", "Appearance", N], ["Tracejado", "Dashes", N], ["Afunilar contorno", "Taper stroke", N], ["Ligar e desligar efeitos", "Toggle effects", N],
    ["Biblioteca", "Library", N], ["Expressão personalizada", "Custom expression", N], ["Expressões nas layers", "Expressions on layers", N],
    ["Carrossel e órbita", "Carousel & orbit", N], ["Comando de câmera (assistente)", "Camera command (assistant)", N],
    ["Parallax e profundidade", "Parallax & depth", N], ["Pontos de foco", "Focus points", N], ["Efeitos de câmera 3D", "3D camera effects", N],
    ["Keyframes e 3D", "Keyframes & 3D", N], ["Loops de mídia", "Media loops", N], ["Áudio e final", "Audio & ending", N], ["Composição", "Composition", N],
    ["Limpeza", "Cleanup", N], ["Brilho", "Glow", N], ["Limiar", "Threshold", N], ["Forma e cor", "Shape & color", N], ["Acabamento", "Finishing", N],
    ["Animações", "Animations", N], ["Outros efeitos MP", "Other MP effects", N], ["Glow", "Glow", N],
    ["Aplicar", "Apply", U], ["Aplicar glow", "Apply glow", U], ["Escanear", "Scan", N], ["Executar", "Run", U], ["Criar", "Create", U], ["Remover", "Remove", U],
    ["Limpar", "Clear", U], ["Salvar", "Save", U], ["Usar", "Use", U], ["Animar:", "Animate:", U], ["Entrada", "In", U], ["Saída", "Out", U],
    ["Entrada e Saída", "In & Out", U], ["Entre cenas", "Between scenes", U], ["Aplicar loop", "Apply loop", U], ["Duração", "Duration", U],
    ["Escalonar", "Stagger", U], ["Playhead", "Playhead", N], ["Marcador", "Marker", U], ["Intensidade", "Intensity", U], ["Início", "Start", N],
    ["Nenhuma animação selecionada", "No animation selected", U], ["Monte sua animação", "Build your animation", U],
    ["1 · Entrada", "1 · In", U], ["2 · Loop (opcional)", "2 · Loop (optional)", U], ["3 · Saída", "3 · Out", U], ["Montar nas layers selecionadas", "Build on selected layers", U],
    ["Sem entrada", "No entrance", U], ["Sem loop", "No loop", U], ["Sem saída", "No exit", U], ["Igual à entrada (espelhada)", "Same as entrance (mirrored)", U],
    ["Buscar animações", "Search animations", U], ["Buscar efeitos, presets e animações…", "Search effects, presets and animations…", U],
    ["Tudo", "All", U], ["Presets", "Presets", U], ["Motion Panel", "Motion Panel", U], ["Atalho no painel", "Panel shortcut", U],
    ["Atalho com o AE em primeiro plano…", "Shortcut with AE in front…", U], ["Busca rápida", "Quick search", U], ["Nada encontrado.", "Nothing found.", U],
    ["Carregar fontes", "Load fonts", U], ["Tamanho", "Size", N], ["Cor", "Color", U], ["De", "From", U], ["até", "to", U], ["casas", "decimals", U], ["Formato", "Format", U],
    ["Prefixo", "Prefix", U], ["Sufixo", "Suffix", U], ["Idioma", "Language", U],
    // ---- explanations (descriptions)
    ["Faixa de brilho atravessa a layer a partir do playhead.", "A light streak sweeps across the layer from the playhead.", U],
    ["Distorções e saltos aleatórios, ajustáveis por sliders.", "Random distortions and jumps, adjustable with sliders.", U],
    ["Ondulação orgânica animada (bandeira, água, calor).", "Animated organic waviness (flag, water, heat).", U],
    ["Remove o fundo verde ou azul com o Keylight.", "Removes a green or blue background with Keylight.", U],
    ["Espelha no tempo os keyframes selecionados (ou todos da propriedade).", "Mirrors the selected keyframes in time (or all keys of the property).", U],
    ["Liga ou desliga o 3D das layers selecionadas.", "Turns 3D on or off for the selected layers.", U],
    ["Repete a layer em mosaico e faz ela rolar sem fim.", "Tiles the layer and scrolls it endlessly.", U],
    ["Vídeo ou precomp em loop até o fim da composição.", "Loops a video or precomp until the end of the comp.", U],
    ["Analisa a música selecionada e cria marcadores nas batidas.", "Analyzes the selected music and adds markers on the beats.", U],
    ["Selecione a música e as layers: a escala pulsa com o som.", "Select the music and the layers: their scale pulses with the sound.", U],
    ["Entrada e saída suaves no volume das layers selecionadas.", "Smooth volume fade in and out on the selected layers.", U],
    ["Escurece tudo no fim da área de trabalho.", "Fades everything to a color at the end of the work area.", U],
    ["Cria uma cópia da comp em outro formato, já reenquadrada.", "Duplicates the comp in another aspect ratio, already reframed.", U],
    ["Cores de label por tipo: texto, shape, precomp, vídeo, áudio, null…", "Label colors by type: text, shape, precomp, video, audio, null…", U],
    ["Libera a memória e o cache de disco do After Effects.", "Frees After Effects memory and disk cache.", U],
    ["Câmera avança enquanto a lente abre: o fundo “estica”.", "The camera pushes in while the lens widens: the background “stretches”.", U],
    ["Leve tremor orgânico contínuo, como câmera no ombro.", "Subtle continuous organic shake, like a shoulder-held camera.", U],
    ["Chacoalhão que some rápido, no playhead. Repita para mais impactos.", "A quick decaying jolt at the playhead. Repeat for more hits.", U],
    ["Câmera vem de longe e para no enquadramento atual.", "The camera flies in from far away and lands on the current framing.", U],
    ["Recuo acelerado para fechar a cena.", "An accelerating pull-out to close the scene.", U],
    ["Desliza de lado girando levemente até a posição atual.", "Slides in from the side with a slight turn to the current position.", U],
    ["Pulso de zoom em cada batida marcada na música selecionada.", "A zoom pulse on every beat marked on the selected music.", U],
    ["Liga a profundidade de campo e mantém a layer selecionada em foco.", "Turns on depth of field and keeps the selected layer in focus.", U],
    ["Troca o foco da 1ª layer selecionada para a 2ª, a partir do playhead.", "Pulls focus from the 1st selected layer to the 2nd, from the playhead.", U],
    ["Efeitos de um clique: light sweep, glitch, batidas, formatos e limpeza.", "One-click effects: light sweep, glitch, beats, formats and cleanup.", U],
    ["Glow com aparência física: bloom em camadas, limiar suave, proporção, aberração cromática e dither.", "Physically-styled glow: layered bloom, soft threshold, aspect, chromatic aberration and dither.", U],
    ["Alinhar, âncora, precomp, criar layers, efeitos rápidos e utilidades.", "Align, anchor, precomp, create layers, quick effects and utilities.", U],
    ["Câmera 3D, parallax, pontos de foco e efeitos de câmera.", "3D camera, parallax, focus points and camera effects.", U],
    ["Modelos prontos e overlays em um clique.", "Ready-made templates and overlays in one click.", U],
    ["Easy Ease e editor de curvas de velocidade.", "Easy Ease and speed-curve editor.", U],
    ["Encontre e troque fontes da comp e das precomps.", "Find and replace fonts in the comp and its precomps.", U],
    ["Aparência, Trim Paths, tracejado e afunilamento.", "Appearance, Trim Paths, dashes and taper.", U],
    ["Ligue e desligue efeitos em lote para acelerar a prévia.", "Toggle effects in bulk to speed up previews.", U],
    ["Gradientes lineares e radiais, com fluxo animado.", "Linear and radial gradients with animated flow.", U],
    ["Biblioteca, expressões salvas e varredura das layers.", "Library, saved expressions and a layer scan.", U],
    ["Carrossel 3D e órbita 2D em volta de um null.", "3D carousel and 2D orbit around a null.", U],
    ["Nome e cargo com barra animada", "Name and role with an animated bar", U], ["Título com letras subindo e linha", "Title with rising letters and a line", U],
    ["Contagem regressiva com anel", "Countdown with a ring", U], ["Flash branco no playhead", "White flash at the playhead", U],
    ["Clique para ver as opções. Clique direito aplica direto com as últimas opções.", "Click to see the options. Right-click applies right away with the last options.", U],
    // ---- expression library (names and explanations)
    ["Loop ciclo", "Loop cycle", N], ["Loop ping-pong", "Loop ping-pong", N], ["Girar contínuo", "Continuous spin", N], ["Inércia", "Inertia", N],
    ["Squash & stretch", "Squash & stretch", N], ["Seguir com atraso", "Delayed follow", N], ["Olhar para", "Look at", N], ["Relógio mm:ss", "Clock mm:ss", N],
    ["Contagem regressiva", "Countdown timer", N], ["Fade automático", "Auto fade", N], ["Piscar aleatório", "Random blink", N],
    ["Compensar escala do pai", "Compensate parent scale", N], ["Tempo por marcador", "Time per marker", N],
    ["Qualquer propriedade", "Any property", U], ["Repete os keyframes", "Repeats the keyframes", U], ["Vai e volta", "Goes back and forth", U],
    ["Balanço depois do último keyframe", "Overshoot after the last keyframe", U], ["Posição: segue a layer de cima", "Position: follows the layer above", U],
    ["Rotação: aponta para a layer de cima", "Rotation: points at the layer above", U], ["Texto de origem", "Source text", U],
    ["Texto de origem (10 s)", "Source text (10 s)", U], ["Opacidade: entra e sai", "Opacity: fades in and out", U],
    ["Reinicia a cada marcador da layer", "Restarts at every layer marker", U],
    ["Gira sem parar; mude a velocidade no número da expressão.", "Spins non-stop; change the speed in the expression number.", U],
    // ---- hover explanations (instead of expression code)
    ["Segue o marcador da animação: mover ou esticar o marcador ajusta a animação.", "Follows the animation marker: moving or stretching the marker retimes the animation.", U],
    ["Loop do Motion Panel, ajustado pelos sliders MP em Efeitos.", "Motion Panel loop, adjusted with the MP sliders in Effect Controls.", U],
    ["Parte do Glow do Motion Panel (sliders MP Glow).", "Part of the Motion Panel Glow (MP Glow sliders).", U],
    ["Contador numérico: o slider MP Contador % é o progresso (0–100%); os valores inicial e final ficam na expressão.", "Number counter: the MP Contador % slider is the progress (0–100%); the start and end values live in the expression.", U],
    ["Contagem regressiva do modelo.", "Countdown from the template.", U],
    ["Movimento do carrossel ou da órbita (slider MP Velocidade).", "Carousel or orbit motion (MP Velocidade slider).", U],
    ["Gradiente animado (slider MP Gradiente Velocidade).", "Animated gradient (MP Gradiente Velocidade slider).", U],
    ["Movimento do light leak.", "Light leak motion.", U], ["Glitch contínuo (sliders MP Glitch).", "Continuous glitch (MP Glitch sliders).", U],
    ["Turbulência animada.", "Animated turbulence.", U], ["Rolagem da esteira infinita (sliders MP Esteira).", "Infinite scroll motion (MP Esteira sliders).", U],
    ["Escala reagindo à música (slider MP Batida Intensidade).", "Scale reacting to the music (MP Batida Intensidade slider).", U],
    ["Câmera na mão (sliders MP Mão).", "Handheld camera (MP Mão sliders).", U],
    ["Tremida de impacto nos marcadores do null-alvo.", "Impact shake on the target null's markers.", U],
    ["Zoom da câmera nas batidas marcadas.", "Camera zoom on the marked beats.", U], ["Foco da câmera preso a uma layer.", "Camera focus locked to a layer.", U],
    ["Troca de foco da câmera entre duas layers.", "Camera focus pull between two layers.", U], ["Tracejado andando.", "Moving dashes.", U],
    ["Vídeo em loop até o fim da comp.", "Video looping until the end of the comp.", U], ["Repete os keyframes (loopOut).", "Repeats the keyframes (loopOut).", U],
    ["Movimento aleatório (wiggle).", "Random motion (wiggle).", U],
    ["Expressão personalizada. Abra a propriedade no After Effects para ver ou editar o código.", "Custom expression. Open the property in After Effects to see or edit the code.", U],
    ["Expressão personalizada salva. Clique em Usar para ver o código.", "Saved custom expression. Click Use to see the code.", U],
    ["Controlado por expressão (loop, marcador ou ferramenta do Motion Panel)", "Driven by an expression (Motion Panel loop, marker or tool)", U],
    ["Tem keyframes: o valor é gravado no tempo atual", "Has keyframes: the value is written at the current time", U],
    ["Cria uma layer de texto nova no centro da comp, a partir do playhead, já animada de “De” até “Até”. O ritmo fica no slider “MP Contador %” (progresso 0–100%), sem limite de tamanho do número.",
      "Creates a new text layer at the comp center, from the playhead, already counting from “From” to “To”. The pace lives in the “MP Contador %” slider (0–100% progress), with no limit on the number size.", U],
    ["Fonte (nome PostScript, ex.: Arial-BoldMT)", "Font (PostScript name, e.g. Arial-BoldMT)", U],
    ["Lista as fontes instaladas para sugerir enquanto você digita", "Lists the installed fonts to suggest while you type", U],
    ["Idioma dos nomes e explicações", "Language of names and explanations", U],
    // ---- rearrangeable boxes
    ["Meia largura", "Half width", U], ["Largura inteira", "Full width", U], ["Ajustar altura (arraste a borda de baixo)", "Adjust height (drag the bottom edge)", U],
    ["Altura automática", "Automatic height", U], ["Mover para cima", "Move up", U], ["Mover para baixo", "Move down", U],
    ["Restaurar organização desta aba", "Reset this tab's layout", U], ["Segure e arraste para mudar a posição", "Hold and drag to change the position", U],
    ["Tamanho e posição da caixa", "Box size and position", U], ["Animação removida: marcador, controle e keyframes.", "Animation removed: marker, control and keyframes.", U],
    ["Borda", "Stroke", U], ["Pontas redondas", "Round caps", U], ["Espessura", "Width", U], ["Camada sólida", "Solid layer", N], ["Camada com gradiente", "Gradient layer", N], ["Criar camada sólida", "Create solid layer", U], ["Criar gradiente", "Create gradient", U], ["Posição", "Position", U], ["Assistente de expressões (IA local)", "Expression assistant (local AI)", N], ["Aplicar em", "Apply to", U], ["Automático", "Automatic", U], ["Propriedade selecionada", "Selected property", U], ["Exemplos", "Examples", U],
    ["+ Cor", "+ Color", N], ["Ativar marcados", "Enable checked", N], ["Ativar todas", "Enable all", N], ["Desativar marcados", "Disable checked", N], ["Desativar todas", "Disable all", N], ["Colar", "Paste", N], ["Copiar", "Copy", N], ["Cortar antes", "Trim before", N], ["Cortar depois", "Trim after", N], ["Dividir máscaras", "Split masks", N], ["Duplicar real", "True duplicate", N], ["Encaixar", "Fit", N], ["Esticar", "Stretch", N], ["Ler do keyframe", "Read from keyframe", N], ["Limpar paradas", "Clear stops", N], ["MAIÚSCULAS", "UPPERCASE", N], ["minúsculas", "lowercase", N], ["Título", "Title", N], ["Null pai", "Parent null", N], ["Organizar", "Organize", N], ["Sequenciar", "Sequence", N], ["Trocar fonte", "Replace font", N], ["Ciclo", "Cycle", N], ["Continuar", "Continue", N], ["★ Favoritar", "★ Favorite", N], ["Adicionar", "Add", N], ["Tela", "Screen", N], ["Raio", "Radius", N], ["Exposição", "Exposure", N], ["Espalhamento", "Spread", N], ["Camadas", "Layers", N], ["Proporção", "Aspect", N], ["Ângulo", "Angle", N], ["Tingir", "Tint", N], ["Aberração cromática", "Chromatic aberration", N], ["Dither (anti-banding)", "Dither (anti-banding)", N], ["Blending linear do projeto", "Project linear blending", N], ["Fundo preto vira transparente", "Black background becomes transparent", N], ["Frequência", "Frequency", N], ["Velocidade", "Speed", N], ["Cor do fundo", "Background color", N], ["Vel. X", "Speed X", N], ["Vel. Y", "Speed Y", N], ["Sensibilidade", "Sensitivity", N], ["Encaixe", "Fit", N], ["Caber inteiro", "Fit whole", N], ["Cor do sólido", "Solid color", N], ["Fonte (PostScript)", "Font (PostScript)", N], ["Ler da layer", "Read from layer", N], ["Preenchimento", "Fill", N], ["Parágrafo", "Paragraph", N], ["Nome", "Name", N], ["Aplicar nos keyframes", "Apply to keyframes", N], ["Salvar curva atual", "Save current curve", N], ["Escanear comp", "Scan comp", N], ["Carregar fontes do sistema", "Load system fonts", N], ["Só layers selecionadas", "Selected layers only", N], ["Radial", "Radial", N], ["Início X", "Start X", N], ["Aplicar estilo", "Apply style", N], ["Trim Paths", "Trim Paths", N], ["Fim", "End", N], ["Animar desenho", "Animate drawing", N], ["Animar fluxo", "Animate flow", N], ["Animação", "Animation", N], ["Aplicar parallax", "Apply parallax", N], ["Aproximar", "Push in", N], ["Afastar", "Pull out", N], ["Abertura", "Aperture", N], ["Camadas", "Layers", N], ["Centralizar", "Center", N], ["Cores", "Colors", N], ["Cópias", "Copies", N], ["Contagem a partir de", "Count from", N], ["Cor de destaque", "Accent color", N], ["Criar câmera", "Create camera", N], ["Criar sequência", "Create sequence", N], ["Descer", "Down", N], ["Distância entre camadas", "Layer spacing", N], ["Efeito", "Effect", N], ["Encarar câmera", "Face camera", N], ["Escala horizontal", "Horizontal scale", N], ["Escala vertical", "Vertical scale", N], ["Espaço", "Space", N], ["Espessura do contorno", "Stroke width", N], ["Expressão", "Expression", N], ["Fade de profundidade", "Depth fade", N], ["Ferramenta", "Tool", N], ["Floresta", "Forest", N], ["Forte", "Strong", N], ["Força", "Strength", N], ["Gelo", "Ice", N], ["Girar ↺", "Roll ↺", N], ["Girar ↻", "Roll ↻", N], ["Inclinar ↑", "Tilt ↑", N], ["Inclinar ↓", "Tilt ↓", N], ["Início compr.", "Start length", N], ["Keyframes", "Keyframes", N], ["Lateral ←", "Truck ←", N], ["Lateral →", "Truck →", N], ["Lava", "Lava", N], ["Loop", "Loop", N], ["Manter tamanho aparente", "Keep apparent size", N], ["Menta", "Mint", N], ["Oceano", "Ocean", N], ["Onde", "Where", N], ["Ouro", "Gold", N], ["Pausa", "Hold", N], ["Pêssego", "Peach", N], ["Pôr do sol", "Sunset", N], ["Preset", "Preset", N], ["Pulso", "Pulse", N], ["Recuo da primeira linha", "First-line indent", N], ["Recuo à direita", "Right indent", N], ["Recuo à esquerda", "Left indent", N], ["Selecionadas", "Selected", N], ["Sobrescrito", "Superscript", N], ["Subscrito", "Subscript", N], ["Subir", "Up", N], ["Subtítulo", "Subtitle", N], ["Tamanho da fonte", "Font size", N], ["Traço", "Dash", N], ["Tudo em maiúsculas", "All caps", N], ["Versalete", "Small caps", N], ["Uva", "Grape", N], ["Zoom +", "Zoom +", N], ["Zoom −", "Zoom −", N], ["Órbita ←", "Orbit ←", N], ["Órbita →", "Orbit →", N], ["Carvão", "Charcoal", N], ["Aurora", "Aurora", N], ["Negrito falso", "Faux bold", N], ["Itálico falso", "Faux italic", N], ["Justificar tudo", "Justify all", N], ["Justificar, última linha centralizada", "Justify, last line centered", N], ["Justificar, última linha à direita", "Justify, last line right", N], ["Justificar, última linha à esquerda", "Justify, last line left", N], ["Espaço antes do parágrafo", "Space before paragraph", N], ["Espaço depois do parágrafo", "Space after paragraph", N], ["Deslocamento da linha de base", "Baseline shift", N], ["Espaçamento entre letras (tracking)", "Tracking", N], ["Entrelinha (vazio = automática)", "Leading (empty = auto)", N], ["Tsume (aperta o espaço ao redor dos caracteres)", "Tsume (tightens the space around characters)", N], ["Recarregar", "Reload", N], ["Stories 9:16 (1080×1920)", "Stories 9:16 (1080×1920)", N], ["Feed 4:5 (1080×1350)", "Feed 4:5 (1080×1350)", N], ["Quadrado 1:1 (1080×1080)", "Square 1:1 (1080×1080)", N], ["Paisagem 16:9 (1920×1080)", "Landscape 16:9 (1920×1080)", N], ["balanço", "swing", N], ["pêndulo", "pendulum", N], ["saída", "out", N], ["entrada e saída", "in and out", N], ["Sem movimento", "No motion", N], ["Reaplicar substitui o glow anterior. Depois de aplicar, tudo continua ajustável nos sliders “MP Glow -” da layer.", "Re-applying replaces the previous glow. After applying, everything stays adjustable in the layer’s “MP Glow -” sliders.", U], ["Suavizar abaixa o limiar das camadas mais largas, dando uma transição macia.", "Soften lowers the threshold of the wider layers for a smooth transition.", U], ["Fundo preto aplica o modo Tela na layer (bom para fogo, partículas e light leaks).", "Black background sets the layer to Screen (good for fire, particles and light leaks).", U], ["Move o anchor point sem deslocar a layer.", "Moves the anchor point without moving the layer.", U], ["Remove todos os efeitos das layers selecionadas", "Removes every effect from the selected layers", U], ["Valores lidos de “", "Values read from “", U], ["Carregar fontes do sistema para autocompletar", "Load system fonts for autocomplete", U], ["Curva lida do keyframe selecionado.", "Curve read from the selected keyframe.", U], ["Dê um nome para a curva.", "Give the curve a name.", U], ["Clique em Escanear para listar as fontes da comp.", "Click Scan to list the comp fonts.", U], ["PostScript da nova fonte", "New font PostScript name", U], ["Nenhuma fonte favorita.", "No favorite fonts.", U], ["Nenhuma layer de texto encontrada.", "No text layer found.", U], ["Inclui precomps aninhadas.", "Includes nested precomps.", U], ["Escolha na lista a fonte que vai ser trocada.", "Pick in the list the font to replace.", U], ["Digite o nome PostScript da nova fonte.", "Type the PostScript name of the new font.", U], ["Cria uma shape do tamanho da comp. A cor e a opacidade continuam editáveis no After Effects (Conteúdo › Preenchimento).", "Creates a comp-sized shape. Color and opacity stay editable in After Effects (Contents › Fill).", U], ["Remover esta cor", "Remove this color", U], ["Fora do After Effects (só pré-visualização).", "Outside After Effects (preview only).", U], ["Arraste os pontos na prévia", "Drag the points in the preview", U], ["O gradiente é desenhado no tamanho da comp e entra como uma layer PNG (salva em Documentos › Motion Panel › Gradientes). Para mudar, ajuste aqui e crie de novo.", "The gradient is drawn at comp size and comes in as a PNG layer (saved in Documents › Motion Panel › Gradients). To change it, adjust here and create it again.", U], ["Adicione paradas primeiro.", "Add stops first.", U], ["Animação desligada.", "Animation off.", U], ["Animação ligada.", "Animation on.", U], ["Animação removida.", "Animation removed.", U], ["Aparecer e sumir em 1 segundo", "Fade in and out in 1 second", U], ["Batimento de coração na escala", "Heartbeat on scale", U], ["Cada modelo vira uma precomp no playhead.", "Each template becomes a precomp at the playhead.", U], ["Categorias anteriores", "Previous categories", U], ["Clique em Escanear.", "Click Scan.", U], ["Clique nos movimentos com o modo Paradas ligado para montar uma sequência.", "Click moves with Stops mode on to build a sequence.", U], ["Clique para remover", "Click to remove", U], ["Contador de 0 até 1500 em 3 segundos", "Counter from 0 to 1500 in 3 seconds", U], ["Desativar efeitos pesados acelera a prévia sem apagar nada.", "Disabling heavy effects speeds up previews without deleting anything.", U], ["Descreva o efeito: o resultado aparece aqui enquanto você digita.", "Describe the effect: the result shows here as you type.", U], ["Descreva pelo menos um movimento.", "Describe at least one move.", U], ["Descreva um efeito primeiro.", "Describe an effect first.", U], ["Dê um nome e escreva a expressão.", "Give it a name and write the expression.", U], ["Escreva ou cole uma expressão…", "Write or paste an expression…", U], ["Ex.: Aproxime a câmera lentamente e depois faça um movimento lateral suave para a direita.", "E.g.: Slowly push the camera in, then a soft truck to the right.", U], ["Ex.: Tremer a posição 2 vezes por segundo com 30 px", "E.g.: Shake the position 2 times per second by 30 px", U], ["Filtrar efeitos", "Filter effects", U], ["Flutuar suavemente", "Float gently", U], ["Gerada pelo assistente: ", "Generated by the assistant: ", U], ["Girar sem parar 90 graus por segundo", "Spin nonstop at 90 degrees per second", U], ["Lendo efeitos e presets do After Effects…", "Reading effects and presets from After Effects…", U], ["Mais categorias", "More categories", U], ["Marcador ajustado.", "Marker adjusted.", U], ["Marque os efeitos na lista.", "Check the effects in the list.", U], ["Nenhum efeito.", "No effects.", U], ["Nenhuma expressão salva.", "No saved expressions.", U], ["Nenhuma expressão.", "No expressions.", U], ["Não entendi. Tente palavras como tremer, pulsar, girar, balançar, flutuar, quicar, piscar, seguir, contador, relógio.", "I didn’t understand. Try words like shake, pulse, spin, swing, float, bounce, blink, follow, counter, clock.", U], ["Não reconheci nenhum movimento. Use palavras como aproxime, afaste, lateral, suba, órbita, zoom, pausa.", "No move recognized. Use words like push, pull, truck, up, orbit, zoom, hold.", U], ["O plano aparece aqui enquanto você digita.", "The plan shows here as you type.", U], ["Piscar rápido", "Blink fast", U], ["Pulsar a escala devagar", "Slowly pulse the scale", U], ["Pêndulo de 20 graus diminuindo aos poucos", "20-degree pendulum slowly settling", U], ["Quicar 80 px", "Bounce 80 px", U], ["Recarregar a lista de efeitos e presets do After Effects", "Reload the list of effects and presets from After Effects", U], ["Salvar as cores atuais como preset", "Save the current colors as a preset", U], ["Seguir a layer de cima com 0.3 s de atraso", "Follow the layer above with a 0.3 s delay", U], ["Selecione a propriedade na timeline e clique para aplicar.", "Select the property in the timeline and click to apply.", U], ["Selecione layers e clique em Aplicar loop.", "Select layers and click Apply loop.", U], ["Selecione layers e escolha Entrada, Saída ou Entrada e Saída.", "Select layers and choose In, Out or In & Out.", U], ["Selecione layers na comp e escolha uma ferramenta.", "Select layers in the comp and choose a tool.", U], ["Sem layer selecionada, cria um sólido com o gradiente.", "With no layer selected, creates a solid with the gradient.", U], ["Tremer a posição 2 vezes por segundo com 30 px", "Shake the position 2 times per second by 30 px", U], ["Usar este exemplo", "Use this example", U], ["balanço elástico depois do último keyframe", "elastic overshoot after the last keyframe", U], ["relógio mm:ss desde o início da layer", "mm:ss clock since the layer start", U], ["Meu gradiente ", "My gradient ", N],
    ["Básico", "Basics", N], ["Animar", "Animate", N], ["Legendas", "Captions", N], ["Sólido", "Solid", N], ["Ajuste", "Adjustment", N], ["Null", "Null", N], ["Pre-compor", "Pre-compose", N], ["Sequência", "Sequence", N], ["Comp", "Comp", N], ["Juntas", "Together", N], ["Separadas", "Separately", N], ["Desfazer", "Unpack", N], ["Opções da sequência", "Sequence options", N], ["Modo", "Mode", N], ["Curva", "Curve", N], ["Grupos de", "Groups of", N], ["Começar em", "Start at", N], ["Inverter", "Reverse", N], ["Encadear", "Chain", N], ["Cortar", "Trim", N], ["Linear", "Linear", N], ["Acelera", "Ease in", N], ["Desacelera", "Ease out", N], ["S", "S", N], ["1ª layer", "1st layer", N], ["Intervalo", "Gap", N], ["Fatiar texto", "Text Slicer", N], ["Importar legendas", "Import captions", N], ["Selecionar", "Select", N], ["Visual", "Look", N], ["Layout", "Layout", N], ["Destaque", "Highlight", N], ["Fundo", "Background", N], ["Cor do texto", "Text color", N], ["Por", "By", N], ["Altura", "Height", N], ["Fonte", "Font", N], ["Nenhuma", "None", N], ["Legenda", "Caption", N], ["Palavra", "Word", N], ["+ Salvar look", "+ Save look", N], ["Precomp", "Precomp", N], ["Projeto", "Project", N], ["Organizar layers", "Label layers", N], ["Esquerda", "Left", N], ["Centro horizontal", "Horizontal center", N], ["Direita", "Right", N], ["Topo", "Top", N], ["Centro vertical", "Vertical center", N], ["Base", "Bottom", N], ["Títulos", "Titles", N], ["Explicações", "Explanations", N], ["Escolha um ponto", "Pick a point", U], ["cor da palavra falada", "active word color", U], ["placa atrás da legenda", "plate under the whole caption", U], ["sombra suave no texto", "soft drop shadow on text", U], ["layer(s) por passo", "layer(s) per step", U], ["Ocultar layer original", "Hide original layer", U], ["Colorir novas layers", "Color-label new layers", U], ["Nenhuma legenda", "No captions", U], ["legendas", "captions", U], ["% da tela", "% of the frame", U], ["Nome PostScript (ex.: Inter-Bold)", "PostScript name (e.g. Inter-Bold)", U], ["Abra uma composição", "Open a composition", U], ["Sem composição", "No composition", U], ["Arraste para ajustar · clique duplo para digitar", "Drag to adjust · double-click to type", U], ["Erro no AE sem detalhes.", "After Effects error without details.", U], ["Resposta inválida do AE.", "Invalid response from After Effects.", U], ["Com layers selecionadas, o null vira pai delas", "With layers selected, the null becomes their parent", U], ["Clique: pre-compor juntas · seta: mais opções", "Click: pre-compose together · arrow: more options", U], ["Ordem: clique para trocar", "Order: click to change", U], ["Sequenciar as layers selecionadas", "Sequence the selected layers", U], ["de cima", "top first", U], ["de baixo", "bottom first", U], ["na seleção", "selection order", U], ["aleatória", "random", U], ["Selecionar todas as legendas", "Select all captions", U], ["Reaplicar o estilo", "Reapply the style", U], ["Exportar .srt", "Export .srt", U], ["Clique: aplicar · Alt+clique: excluir", "Click: apply · Alt+click: delete", U], ["Limite de 6 looks salvos.", "Limit of 6 saved looks.", U], ["Look salvo.", "Look saved.", U], ["Fatiar texto em letras, palavras ou linhas.", "Split text into letters, words or lines.", U], ["Importar .srt, .vtt ou .json, estilo, movimento e exportação.", "Import .srt, .vtt or .json, style, motion and export.", U], ["Buscar efeito ou preset…", "Search effect or preset…", U], ["↑↓ navegar · Enter aplica · Esc fecha", "↑↓ navigate · Enter applies · Esc closes", U], ["Pinta as layers da comp por tipo (texto, shape, vídeo…)", "Colors the comp layers by type (text, shape, video…)", U], ["Limpa o cache de memória e de disco", "Purges memory and disk cache", U], ["Selecione a música (e as layers): pulso de zoom em cada batida. Marca as batidas sozinho se faltar.", "Select the music (and layers): a zoom pulse on every beat. Marks the beats itself if needed.", U], ["Vale para os keyframes selecionados na timeline.", "Applies to the keyframes selected in the timeline.", U], ["Selecione 2 ou mais keyframes vizinhos na timeline. A curva vale para cada intervalo entre eles.", "Select 2 or more neighbouring keyframes in the timeline. The curve applies to each interval between them.", U], ["Clique de novo para confirmar", "Click again to confirm", U], ["Pinta as layers por tipo", "Colors layers by type", U],
    ["Áudio", "Audio", N], ["Definir volume", "Set Volume", N], ["Mudo", "Mute", N], ["Ducking", "Ducking", N], ["Crossfade", "Crossfade", N], ["Igualar volumes", "Match Levels", N], ["Visualizador de áudio", "Audio Visualizer", N], ["Bass & Treble", "Bass & Treble", N], ["High-Low Pass", "High-Low Pass", N], ["Reverb", "Reverb", N], ["Delay", "Delay", N], ["Stereo Mixer", "Stereo Mixer", N], ["Backwards", "Backwards", N], ["Volume, fades, mixagem, ritmo e efeitos de áudio.", "Volume, fades, mixing, rhythm and audio effects.", U], ["Volume", "Volume", N], ["Mixagem", "Mixing", N], ["Ritmo", "Rhythm", N], ["Efeitos de áudio", "Audio effects", N], ["Visualizar", "Visualize", N], ["Ajusta o nível das layers selecionadas (dB). Com keyframes, desloca todos juntos.", "Sets the level of the selected layers (dB). With keyframes, shifts them all together.", U], ["Liga, desliga ou alterna o áudio das layers selecionadas.", "Turns the audio of the selected layers on, off, or toggles it.", U], ["Selecione a voz primeiro e depois a música: a música abaixa enquanto a voz fala.", "Select the voice first, then the music: the music dips while the voice speaks.", U], ["Transição cruzada entre layers de áudio em sequência; sobrepõe se precisar.", "Cross transition between audio layers in sequence; overlaps them if needed.", U], ["Analisa as layers e iguala o pico de todas ao da mais alta.", "Analyzes the layers and matches every peak to the loudest one.", U], ["Reforça ou corta graves e agudos.", "Boosts or cuts bass and treble.", U], ["Filtro passa-alta ou passa-baixa (voz de telefone, abafado).", "High-pass or low-pass filter (phone voice, muffled).", U], ["Ambiência de sala.", "Room ambience.", U], ["Eco com repetições.", "Echo with repeats.", U], ["Volume e pan de cada canal.", "Volume and pan of each channel.", U], ["Toca o áudio de trás para frente.", "Plays the audio backwards.", U], ["Cria uma layer com espectro ou forma de onda lendo a música selecionada.", "Creates a layer with a spectrum or waveform reading the selected music.", U], ["Nível", "Level", U], ["Ação", "Action", U], ["Alternar", "Toggle", U], ["Ligar", "Turn on", U], ["Redução", "Reduction", U], ["Suavizar", "Smooth", U], ["Ganho extra", "Extra gain", U], ["Tipo", "Type", U], ["Espectro", "Spectrum", U], ["Forma de onda", "Waveform", U], ["Distribuir", "Distribute", N], ["Distribuir espaçamento", "Distribute spacing", U], ["Alinhar a", "Align to", U], ["Seleção", "Selection", N], ["Alinhar à esquerda", "Align left", U], ["Centralizar na horizontal", "Align horizontal centers", U], ["Alinhar à direita", "Align right", U], ["Alinhar ao topo", "Align top", U], ["Centralizar na vertical", "Align vertical centers", U], ["Alinhar à base", "Align bottom", U], ["Distribuir pelas bordas esquerdas", "Distribute left edges", U], ["Distribuir pelos centros horizontais", "Distribute horizontal centers", U], ["Distribuir pelas bordas direitas", "Distribute right edges", U], ["Distribuir pelos topos", "Distribute top edges", U], ["Distribuir pelos centros verticais", "Distribute vertical centers", U], ["Distribuir pelas bases", "Distribute bottom edges", U], ["Espaçamento horizontal igual", "Equal horizontal spacing", U], ["Espaçamento vertical igual", "Equal vertical spacing", U],
    ["Nenhuma animação", "No animation", U], ["Escolha uma na grade.", "Pick one from the grid.", U], ["Duração em frames", "Duration in frames", U], ["Mais opções", "More options", N], ["Opções", "Options", N], ["Começar no playhead", "Start at playhead", U], ["Limpar layers selecionadas", "Clear selected layers", U], ["Mostrar/ocultar barra lateral", "Show/hide sidebar", U], ["Nenhum favorito ainda", "No favorites yet", U], ["Passe o mouse numa animação e clique na estrela para guardá-la aqui.", "Hover an animation and click the star to keep it here.", U], ["Nada encontrado", "Nothing found", U], ["Tente outro nome, em português ou inglês.", "Try another name, in Portuguese or English.", U], ["Selecione layers e escolha uma ferramenta.", "Select layers and choose a tool.", U], ["Todas as ferramentas", "All tools", U], ["Resumo", "Summary", U], ["Parado", "Hold", U], ["sem loop", "no loop", U], ["Ajuste as animações e efeitos do Motion Panel na layer selecionada.", "Adjust the Motion Panel animations and effects on the selected layer.", U], ["Fora do After Effects", "Outside After Effects", U], ["A aba Editar mostra os efeitos da layer selecionada quando o painel está aberto no After Effects.", "The Edit tab shows the selected layer’s effects when the panel is open in After Effects.", U], ["Nenhuma layer selecionada", "No layer selected", U], ["Selecione uma layer na comp para ver os efeitos dela aqui.", "Select a layer in the comp to see its effects here.", U], ["Sem efeitos do Motion Panel", "No Motion Panel effects", U], ["Aplique uma animação, loop ou ferramenta e ela aparece aqui.", "Apply an animation, loop or tool and it shows up here.", U], ["Nada para editar", "Nothing to edit", U], ["animações", "animations", U], ["Favoritar", "Favorite", U]
  ];
  const BY = new Map();
  E.forEach(([pt, en, kind]) => {
    const rec = { pt, en, kind };
    if (!BY.has(pt)) BY.set(pt, rec);
    if (!BY.has(en)) BY.set(en, rec);
  });
  const store = window.MPUI && window.MPUI.store;
  // Two independent choices: language of the titles (names of effects, tools, animations, section titles)
  // and language of the explanations (descriptions, hints, messages). Old single-mode setting is migrated.
  const LEGACY = { default: { names: "en", ui: "pt" }, pt: { names: "pt", ui: "pt" }, en: { names: "en", ui: "en" } };
  let lang = (store && store.get("lang2", null)) || LEGACY[store ? store.get("lang", "default") : "default"] || LEGACY.default;

  function pick(rec) {
    return (rec.kind === N ? lang.names : lang.ui) === "en" ? rec.en : rec.pt;
  }
  function tr(s) {
    if (s == null) return s;
    const rec = BY.get(String(s).trim());
    return rec ? pick(rec) : s;
  }
  // Translate forcing the kind (for words that are both an effect name and a UI label, e.g. "Curvas").
  function trK(s, kind) {
    if (s == null) return s;
    const rec = BY.get(String(s).trim());
    if (!rec) return s;
    return pick({ pt: rec.pt, en: rec.en, kind: kind });
  }
  // Both language forms of a text (used by the search so either language matches).
  function alt(s) {
    const rec = BY.get(String(s).trim());
    return rec ? rec.pt + " " + rec.en : String(s);
  }

  // ------------------------------------------------------------ DOM translation
  const ATTRS = ["title", "placeholder"];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function translateNode(node) {
    if (node.nodeType === 3) {
      const raw = node.nodeValue, t = raw.trim();
      if (!t) return;
      // Text inserted directly into an element marked data-noi18n (e.g. the tool title) is already localized.
      if (node.parentElement && node.parentElement.closest("[data-noi18n]")) return;
      if (!node.__mpOrig || (node.__mpLast !== raw)) node.__mpOrig = t;
      const out = tr(node.__mpOrig);
      if (out !== t) { node.nodeValue = raw.replace(t, out); }
      node.__mpLast = node.nodeValue;
      return;
    }
    if (node.nodeType !== 1 || SKIP[node.tagName] || node.hasAttribute("data-noi18n")) return;
    ATTRS.forEach((a) => {
      if (!node.hasAttribute(a)) return;
      const key = "__mpOrig_" + a;
      const cur = node.getAttribute(a);
      if (!node[key] || node["__mpLast_" + a] !== cur) node[key] = cur;
      const out = tr(node[key]);
      if (out !== cur) node.setAttribute(a, out);
      node["__mpLast_" + a] = node.getAttribute(a);
    });
    if (node.tagName === "OPTGROUP" && node.label) {
      if (!node.__mpOrigLabel) node.__mpOrigLabel = node.label;
      node.label = node.__mpOrigLabel.split(" › ").map(tr).join(" › ");
    }
    for (let c = node.firstChild; c; c = c.nextSibling) translateNode(c);
  }
  let busy = false;
  const obs = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    muts.forEach((m) => {
      if (m.type === "characterData") translateNode(m.target);
      else if (m.type === "attributes") translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    });
    busy = false;
  });
  function start() {
    translateNode(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function apply() {
    if (store) store.set("lang2", lang);
    busy = true; translateNode(document.body); busy = false;
    document.dispatchEvent(new CustomEvent("mp:lang", { detail: lang }));
  }
  // part: "names" (titles) or "ui" (explanations); value: "pt" | "en"
  function setLang(part, v) { lang = Object.assign({}, lang, { [part]: v }); apply(); }
  function setMode(m) { lang = Object.assign({}, LEGACY[m] || LEGACY.default); apply(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.MPI18N = { tr, trK, alt, setMode, setLang, NAME: N, UI: U, get lang() { return Object.assign({}, lang); }, get mode() { return lang.ui; } };
})();
