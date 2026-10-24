import json
import os

# Esquema completo com TODOS os 19 gêneros oficiais do TMDB, humores e classificações indicativas
all_genres_schema = {
    "action": "Ação, perseguição de carros, tiroteio, lutas marciais, explosões, heróis e adrenalina",
    "adventure": "Aventura, jornadas épicas, exploração de florestas, templos, viagens e expedições",
    "animation": "Animação, desenhos animados, animações 3D da Pixar, DreamWorks, anime infantil e fantasia visual",
    "comedy": "Comédia, humor, risadas, piadas, besteiras engraçadas, situações cômicas e diversão leve",
    "crime": "Crime, máfia, assaltos a banco, gangues de rua, corrupção, policiais e crimes organizados",
    "documentary": "Documentário, fatos reais verídicos, investigações da natureza, história e biografias reais",
    "drama": "Drama, conflitos humanos profundos, lágrimas, superação de traumas, luto e relações familiares",
    "family": "Família, filmes infantis educativos para ver com crianças pequenas e todos reunidos",
    "fantasy": "Fantasia, magia, feiticeiros, dragões, elfos, reinos medievais encantados e poderes",
    "history": "História de época, eventos históricos passados, monarquias antigas, biografias de época",
    "horror": "Terror, sustos, possessão espiritual, fantasmas, monstros horríveis, slasher e mortes macabras",
    "music": "Música, musicais da Broadway, bandas de rock, cantores, concertos e trilhas sonoras",
    "mystery": "Mistério, detetives estilo Sherlock, enigmas não resolvidos, whodunit e reviravoltas",
    "romance": "Romance, casais apaixonados, comédias românticas, histórias de amor e paixão ardente",
    "scifi": "Ficção científica, naves no espaço, tecnologia do futuro, robôs IA, multiverso e aliens",
    "thriller": "Thriller, suspense psicológico tenso, tensão sufocante, perseguição de serial killers",
    "war": "Guerra militar, batalhas no campo de batalha, soldados no front, tanques e dramas militares",
    "western": "Faroeste, velho oeste bang-bang, caubóis, duelos de revólver ao meio-dia e xerifes"
}

mood_schema = {
    "lighthearted": "Leve, divertido, alto-astral, relaxante, sem estresse para rir e esquecer problemas",
    "intense": "Intenso, eletrizante, adrenalina pura, tensão acelerada e ritmo implacável",
    "emotional": "Emocionante, tocante, de chorar, sensível e reflexivo",
    "dark": "Sombrio, macabro, perturbador, assustador, melancólico e pesado",
    "mysterious": "Misterioso, intrigante, reflexivo, cheio de enigmas para desvendar"
}

rating_schema = {
    "L": "Livre para todos os públicos, recomendado para crianças pequenas e família",
    "10": "Recomendado para maiores de 10 anos, temas leves",
    "12": "Recomendado para maiores de 12 anos, aventura adolescente moderada",
    "14": "Recomendado para maiores de 14 anos, violência ou temas maduros moderados",
    "16": "Recomendado para maiores de 16 anos, violência gráfica, drogas ou conteúdo pesado",
    "18": "Recomendado para maiores de 18 anos, terror extremo, violência explícita e temas adultos"
}

movie_questions = {
    "genre": {
        "type": "choice",
        "instructions": "Qual é o gênero principal do filme ou estilo solicitado?",
        "criteria": all_genres_schema
    },
    "mood": {
        "type": "choice",
        "instructions": "Qual a vibe/tom do filme?",
        "criteria": mood_schema
    },
    "content_rating": {
        "type": "choice",
        "instructions": "Qual a classificação indicativa ideal para a recomendação?",
        "criteria": rating_schema
    }
}

# Dataset ampliado cobrindo referências a filmes famosos ('no mesmo estilo de...') e todos os gêneros
dataset_raw = [
    # Ação / Aventura com referências
    {"state": "Adorei John Wick e Resgate, quero algo no mesmo estilo de ação frenética com lutas reais", "g": "action", "m": "intense", "r": "16"},
    {"state": "Quero um filme de pancadaria e artes marciais com perseguições insanas de tirar o fôlego", "g": "action", "m": "intense", "r": "16"},
    {"state": "Ação épica com super-heróis lutando contra vilões com muitas explosões tipo Vingadores", "g": "action", "m": "intense", "r": "12"},
    {"state": "No estilo de Indiana Jones e Uncharted, exploração de selvas antigas e tesouros perdidos", "g": "adventure", "m": "lighthearted", "r": "12"},
    {"state": "Uma jornada épica de sobrevivência na floresta selvagem enfrentando os perigos da natureza", "g": "adventure", "m": "intense", "r": "12"},
    {"state": "Aventura espacial no estilo Piratas do Caribe mas pelo universo", "g": "adventure", "m": "lighthearted", "r": "10"},

    # Animação
    {"state": "Filme fofo e emocionante no estilo Viva: A Vida é uma Festa e Divertida Mente da Pixar", "g": "animation", "m": "emotional", "r": "L"},
    {"state": "Desenho animado bem infantil e divertido com animais engraçados tipo Shrek e Kung Fu Panda", "g": "animation", "m": "lighthearted", "r": "L"},
    {"state": "Anime japonês com visual lindo estilo A Viagem de Chihiro e Your Name", "g": "animation", "m": "emotional", "r": "10"},
    {"state": "Desenho colorido bem leve para entreter criança de 5 anos", "g": "animation", "m": "lighthearted", "r": "L"},

    # Comédia
    {"state": "Comédia escrachada de morrer de rir no estilo Se Beber Não Case e Superbad", "g": "comedy", "m": "lighthearted", "r": "16"},
    {"state": "Filme muito engraçado de comédia pastelão estilo As Branquelas para relaxar o cérebro", "g": "comedy", "m": "lighthearted", "r": "12"},
    {"state": "Comédia romântica levinha e bem humorada de namoro", "g": "comedy", "m": "lighthearted", "r": "L"},
    {"state": "Humor inteligente com sátiras e piadas hilárias", "g": "comedy", "m": "lighthearted", "r": "14"},

    # Crime e Máfia
    {"state": "Filme no estilo de O Poderoso Chefão, Os Bons Companheiros e máfia italiana", "g": "crime", "m": "dark", "r": "16"},
    {"state": "Grande assalto a banco com plano elaborado e investigação policial estilo La Casa de Papel", "g": "crime", "m": "intense", "r": "16"},
    {"state": "Gangues de rua, drogas, tráfico e submundo do crime organizado", "g": "crime", "m": "dark", "r": "18"},
    {"state": "Detetive caçando criminoso perigoso pelas ruas da cidade", "g": "crime", "m": "intense", "r": "14"},

    # Documentário
    {"state": "Quero um documentário verídico sobre animais selvagens e a beleza do planeta Terra", "g": "documentary", "m": "lighthearted", "r": "L"},
    {"state": "Documentário investigativo de crimes reais de serial killer", "g": "documentary", "m": "dark", "r": "16"},
    {"state": "História real com entrevistas de cientistas e exploração espacial", "g": "documentary", "m": "mysterious", "r": "L"},

    # Drama
    {"state": "Drama emocionante para chorar rios no estilo de À Procura da Felicidade e Milagre na Cela 7", "g": "drama", "m": "emotional", "r": "12"},
    {"state": "História dramática sobre superação de uma doença grave e união familiar", "g": "drama", "m": "emotional", "r": "12"},
    {"state": "Drama pesado e melancólico sobre depressão e solidão estilo Manchester à Beira-Mar", "g": "drama", "m": "dark", "r": "16"},

    # Família
    {"state": "Filme família clássico estilo Esqueceram de Mim para assistir domingo à tarde todo mundo reunido", "g": "family", "m": "lighthearted", "r": "L"},
    {"state": "História bonita sobre um cachorro companheiro e leal para a família inteira", "g": "family", "m": "emotional", "r": "L"},

    # Fantasia
    {"state": "Gosto muito de Harry Potter e Senhor dos Anéis, quero magia, magos e reinos medievais fantásticos", "g": "fantasy", "m": "mysterious", "r": "12"},
    {"state": "Mundo encantado com criaturas mitológicas, fadas e guerreiros élficos", "g": "fantasy", "m": "lighthearted", "r": "10"},
    {"state": "Fantasia sombria com feiticeiros malignos e maldições ancestrais", "g": "fantasy", "m": "dark", "r": "14"},

    # História
    {"state": "Filme de época histórico sobre a Roma Antiga e imperadores estilo Gladiador", "g": "history", "m": "intense", "r": "16"},
    {"state": "Biografia histórica detalhada sobre a realeza britânica e conspirações de época", "g": "history", "m": "emotional", "r": "14"},

    # Terror
    {"state": "Terror macabro que dá medo de verdade estilo Invocação do Mal e Sobrenatural", "g": "horror", "m": "dark", "r": "16"},
    {"state": "Slasher sangrento com assassino mascarado perseguindo jovens estilo Pânico e Sexta-Feira 13", "g": "horror", "m": "intense", "r": "18"},
    {"state": "Terror psicológico claustrofóbico que mexe com a mente no estilo Hereditário", "g": "horror", "m": "dark", "r": "16"},
    {"state": "História de monstros assustadores e possessão demoníaca no convento", "g": "horror", "m": "dark", "r": "16"},

    # Música
    {"state": "Musical alegre e grandioso no estilo La La Land e O Rei do Show com números de dança incríveis", "g": "music", "m": "lighthearted", "r": "L"},
    {"state": "História biográfica de uma estrela do rock e formação de banda estilo Bohemian Rhapsody", "g": "music", "m": "emotional", "r": "14"},

    # Mistério
    {"state": "Quero um filme inteligente de mistério e investigação estilo Entre Facas e Segredos", "g": "mystery", "m": "mysterious", "r": "14"},
    {"state": "Mistério policial com assassinato enigmático e final surpreendente", "g": "mystery", "m": "mysterious", "r": "14"},
    {"state": "Enigma com quebra-cabeças e segredos ocultos para tentar adivinhar quem é o culpado", "g": "mystery", "m": "mysterious", "r": "12"},

    # Romance
    {"state": "História de amor emocionante no estilo Diário de Uma Paixão e Como Eu Era Antes de Você", "g": "romance", "m": "emotional", "r": "12"},
    {"state": "Romance clássico de época com declarações de amor e vestidos de baile estilo Orgulho e Preconceito", "g": "romance", "m": "emotional", "r": "10"},
    {"state": "Casal jovem se apaixonando nas férias de verão de forma doce e bonita", "g": "romance", "m": "lighthearted", "r": "L"},

    # Ficção Científica (Sci-Fi)
    {"state": "Amo Interestelar e Perdido em Marte, quero ficção científica no espaço profundo com buracos de minhoca", "g": "scifi", "m": "intense", "r": "12"},
    {"state": "Futuro distópico cyberpunk com inteligência artificial rebelde estilo Blade Runner e Matrix", "g": "scifi", "m": "dark", "r": "16"},
    {"state": "Viagem no tempo complexa com paradoxos temporais e física teórica", "g": "scifi", "m": "mysterious", "r": "12"},
    {"state": "Invasão alienígena à Terra com tecnologia avançada do futuro", "g": "scifi", "m": "intense", "r": "14"},

    # Suspense / Thriller
    {"state": "Suspense psicológico agoniante e tenso estilo Garota Exemplar e Ilha do Medo", "g": "thriller", "m": "intense", "r": "16"},
    {"state": "Perseguição tensa onde cada minuto conta contra um sequestrador impiedoso", "g": "thriller", "m": "intense", "r": "16"},
    {"state": "Tensão psicológica sufocante com reviravoltas chocantes no final", "g": "thriller", "m": "dark", "r": "14"},

    # Guerra
    {"state": "Filme de guerra realista e impactante no estilo O Resgate do Soldado Ryan e 1917", "g": "war", "m": "intense", "r": "16"},
    {"state": "Batalha sangrenta da Segunda Guerra Mundial com soldados na trincheira e tanques", "g": "war", "m": "intense", "r": "16"},
    {"state": "Drama de pilotos de caça em missões aéreas perigosas no conflito armado", "g": "war", "m": "intense", "r": "14"},

    # Faroeste (Western)
    {"state": "Faroeste bruto com pistoleiros caubóis e duelos de revólver ao meio-dia estilo Django Livre", "g": "western", "m": "intense", "r": "16"},
    {"state": "Velho oeste com xerife honesto defendendo a cidadezinha dos bandidos forasteiros", "g": "western", "m": "intense", "r": "14"},
    {"state": "História épica de caçador de recompensas a cavalo pelas planícies áridas", "g": "western", "m": "intense", "r": "14"}
]

os.makedirs("tmdb_recommender", exist_ok=True)

with open("tmdb_recommender/movie_questions.json", "w", encoding="utf-8") as f:
    json.dump(movie_questions, f, indent=2, ensure_ascii=False)

train_file = "tmdb_recommender/train_all_genres.jsonl"
with open(train_file, "w", encoding="utf-8") as f:
    for item in dataset_raw:
        entry = {
            "state": item["state"],
            "questions": movie_questions,
            "expected": {
                "genre": item["g"],
                "mood": item["m"],
                "content_rating": item["r"]
            }
        }
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

print(f"Dataset completo criado com {len(dataset_raw)} exemplos cobrindo todos os 18 gêneros e estilos em {train_file}!")
