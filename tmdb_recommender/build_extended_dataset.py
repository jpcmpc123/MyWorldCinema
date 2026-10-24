import json
import os
import random

# Esquema oficial ampliado com 5 dimensões: Gênero, Humor, Classificação, Década e País de Origem
extended_schema = {
    "genre": {
        "type": "choice",
        "instructions": "Qual é o gênero principal do filme ou estilo solicitado?",
        "criteria": {
            "action": "Ação, tiroteio, perseguição de carros, lutas marciais, explosões e adrenalina",
            "adventure": "Aventura, jornadas épicas, exploração de florestas, templos e expedições",
            "animation": "Animação, desenhos animados, animações 3D da Pixar, DreamWorks, anime",
            "comedy": "Comédia, humor, risadas, piadas, besteiras engraçadas e diversão leve",
            "crime": "Crime, máfia, assaltos a banco, gangues de rua, corrupção e policiais",
            "documentary": "Documentário, fatos reais verídicos, investigações da natureza e história",
            "drama": "Drama, conflitos humanos profundos, lágrimas, superação de traumas e família",
            "family": "Família, filmes infantis educativos para ver com crianças pequenas",
            "fantasy": "Fantasia, magia, feiticeiros, dragões, elfos e reinos medievais encantados",
            "history": "História de época, eventos históricos passados e monarquias antigas",
            "horror": "Terror, sustos, possessão espiritual, fantasmas e monstros assustadores",
            "music": "Música, musicais, bandas de rock, cantores e concertos",
            "mystery": "Mistério, detetives estilo Sherlock, enigmas não resolvidos e reviravoltas",
            "romance": "Romance, casais apaixonados, comédias românticas e histórias de amor",
            "scifi": "Ficção científica, naves no espaço, tecnologia do futuro, robôs e multiverso",
            "thriller": "Thriller, suspense psicológico tenso, tensão sufocante e perseguições",
            "war": "Guerra militar, batalhas no campo de batalha, soldados no front e tanques",
            "western": "Faroeste, velho oeste bang-bang, caubóis, duelos de revólver ao meio-dia"
        }
    },
    "mood": {
        "type": "choice",
        "instructions": "Qual a vibe/tom do filme?",
        "criteria": {
            "lighthearted": "Leve, divertido, alto-astral, relaxante, sem estresse para rir",
            "intense": "Intenso, eletrizante, adrenalina pura, tensão acelerada e ritmo implacável",
            "emotional": "Emocionante, tocante, de chorar, sensível e reflexivo",
            "dark": "Sombrio, macabro, perturbador, assustador, melancólico e pesado",
            "mysterious": "Misterioso, intrigante, reflexivo, cheio de enigmas para desvendar"
        }
    },
    "content_rating": {
        "type": "choice",
        "instructions": "Qual a classificação indicativa ideal para a recomendação?",
        "criteria": {
            "L": "Livre para todos os públicos, família e crianças",
            "10": "Recomendado para maiores de 10 anos",
            "12": "Recomendado para maiores de 12 anos, aventura moderada",
            "14": "Recomendado para maiores de 14 anos",
            "16": "Recomendado para maiores de 16 anos, conteúdo maduro e violência gráfica",
            "18": "Recomendado para maiores de 18 anos, terror extremo ou violência explícita"
        }
    },
    "decade": {
        "type": "choice",
        "instructions": "Qual a década ou época do filme desejado?",
        "criteria": {
            "80s": "Anos 80 (1980 a 1989), clássicos oitentistas retrô, nostalgia dos anos 80",
            "90s": "Anos 90 (1990 a 1999), clássicos noventistas em VHS, década de 90",
            "2000s": "Anos 2000 (2000 a 2009), filmes dos anos 2000",
            "modern": "Atual / Moderno (2010 até hoje), lançamentos recentes e cinema contemporâneo"
        }
    },
    "origin": {
        "type": "choice",
        "instructions": "Qual o país de origem ou polo cinematográfico desejado?",
        "criteria": {
            "hollywood": "Hollywood / Americano / Cinema internacional ocidental tradicional em inglês",
            "korean": "Coreano / Dorama / Cinema da Coreia do Sul (K-Drama, K-Movies)",
            "national": "Nacional / Cinema Brasileiro / Filmes do Brasil em português",
            "european": "Cinema Europeu / Francês, Italiano, Espanhol, Britânico, Alemão"
        }
    }
}

# Exemplos variados para treinar o modelo cobrindo todas as combinações
dataset_seed = [
    # Coreano / Doramas
    {"state": "Quero um dorama coreano de romance emocionante e fofo lançamento recente", "g": "romance", "m": "emotional", "r": "12", "d": "modern", "o": "korean"},
    {"state": "Filme coreano de zumbi e suspense tenso moderno estilo Invasao Zumbi", "g": "horror", "m": "intense", "r": "16", "d": "modern", "o": "korean"},
    {"state": "Filme da Coreia do Sul estilo Parasita com drama e critica social", "g": "drama", "m": "dark", "r": "16", "d": "modern", "o": "korean"},
    {"state": "Suspense policial coreano brutal com vinganca violenta estilo Oldboy dos anos 2000", "g": "thriller", "m": "dark", "r": "18", "d": "2000s", "o": "korean"},
    {"state": "Comedia coreana divertida e leve de acao recente", "g": "comedy", "m": "lighthearted", "r": "12", "d": "modern", "o": "korean"},

    # Nacional / Cinema Brasileiro
    {"state": "Filme brasileiro nacional estilo Cidade de Deus dos anos 2000 com crime e favela", "g": "crime", "m": "dark", "r": "18", "d": "2000s", "o": "national"},
    {"state": "Comedia nacional brasileira muito engracada estilo Minha Mae e Uma Peca recente", "g": "comedy", "m": "lighthearted", "r": "12", "d": "modern", "o": "national"},
    {"state": "Acao policial brasileira pesada estilo Tropa de Elite dos anos 2000 com o BOPE", "g": "action", "m": "intense", "r": "18", "d": "2000s", "o": "national"},
    {"state": "Classico do cinema nacional dos anos 80 ou 90 como Central do Brasil drama emocionante", "g": "drama", "m": "emotional", "r": "12", "d": "90s", "o": "national"},
    {"state": "Documentario brasileiro sobre a musica popular brasileira e historia do pais", "g": "documentary", "m": "lighthearted", "r": "L", "d": "modern", "o": "national"},

    # Cinema Europeu
    {"state": "Filme frances cult de romance doce e fofo estilo O Fabuloso Destino de Amelie Poulain anos 2000", "g": "romance", "m": "lighthearted", "r": "L", "d": "2000s", "o": "european"},
    {"state": "Suspense espanhol inteligente com reviravolta chocante recente estilo Um Contratempo", "g": "mystery", "m": "mysterious", "r": "14", "d": "modern", "o": "european"},
    {"state": "Drama de epoca britanico com monarquia e realeza da decada de 90", "g": "history", "m": "emotional", "r": "12", "d": "90s", "o": "european"},
    {"state": "Terror europeu macabro e perturbador da Franca estilo Martyrs anos 2000", "g": "horror", "m": "dark", "r": "18", "d": "2000s", "o": "european"},
    {"state": "Guerra da Europa ocidental classica realista recente", "g": "war", "m": "intense", "r": "16", "d": "modern", "o": "european"},

    # Anos 80 (Hollywood / Retrô)
    {"state": "Filme de acao dos anos 80 com brutamontes estilo Rambo, O Exterminador do Futuro e Duro de Matar", "g": "action", "m": "intense", "r": "16", "d": "80s", "o": "hollywood"},
    {"state": "Ficcao cientifica dos anos 80 nostalgica estilo De Volta para o Futuro e Blade Runner", "g": "scifi", "m": "mysterious", "r": "10", "d": "80s", "o": "hollywood"},
    {"state": "Terror slasher dos anos 80 com assassino de mascara estilo Sexta-Feira 13 e A Hora do Pesadelo", "g": "horror", "m": "dark", "r": "18", "d": "80s", "o": "hollywood"},
    {"state": "Aventura infantil dos anos 80 tipo Os Goonies e E.T. O Extraterrestre", "g": "adventure", "m": "lighthearted", "r": "L", "d": "80s", "o": "hollywood"},

    # Anos 90 (Hollywood / Clássicos em VHS)
    {"state": "Suspense psicologico policial dos anos 90 estilo Seven e O Silencio dos Inocentes", "g": "thriller", "m": "dark", "r": "18", "d": "90s", "o": "hollywood"},
    {"state": "Comedia escrachada dos anos 90 estilo O Maskara e Debi e Loide com Jim Carrey", "g": "comedy", "m": "lighthearted", "r": "12", "d": "90s", "o": "hollywood"},
    {"state": "Ficcao cientifica revolucionaria dos anos 90 estilo Matrix e Jurassic Park", "g": "scifi", "m": "intense", "r": "14", "d": "90s", "o": "hollywood"},
    {"state": "Animacao classica dos anos 90 estilo O Rei Leao e Aladdin da Disney", "g": "animation", "m": "emotional", "r": "L", "d": "90s", "o": "hollywood"},
    {"state": "Filme de mafia dos anos 90 estilo Os Bons Companheiros de Martin Scorsese", "g": "crime", "m": "dark", "r": "16", "d": "90s", "o": "hollywood"},

    # Anos 2000 (Hollywood)
    {"state": "Fantasia medieval epica dos anos 2000 estilo O Senhor dos Aneis e Harry Potter", "g": "fantasy", "m": "intense", "r": "12", "d": "2000s", "o": "hollywood"},
    {"state": "Acao de super-heroi dos anos 2000 estilo Homem-Aranha e Batman Cavaleiro das Trevas", "g": "action", "m": "intense", "r": "12", "d": "2000s", "o": "hollywood"},
    {"state": "Comedia adolescente dos anos 2000 estilo Superbad e As Branquelas", "g": "comedy", "m": "lighthearted", "r": "16", "d": "2000s", "o": "hollywood"},
    {"state": "Romance emocionante dos anos 2000 estilo Diario de Uma Paixao", "g": "romance", "m": "emotional", "r": "12", "d": "2000s", "o": "hollywood"},

    # Modernos / Atuais (2010 em diante)
    {"state": "Acao moderna frenetica lancamento recente estilo John Wick 4 e Resgate", "g": "action", "m": "intense", "r": "16", "d": "modern", "o": "hollywood"},
    {"state": "Ficcao cientifica recente no espaco profundo estilo Interestelar, Duna e Perdido em Marte", "g": "scifi", "m": "intense", "r": "12", "d": "modern", "o": "hollywood"},
    {"state": "Terror moderno perturbador estilo Hereditario e Invocacao do Mal lancamentos", "g": "horror", "m": "dark", "r": "16", "d": "modern", "o": "hollywood"},
    {"state": "Animacao 3D recente e fofa estilo Divertida Mente 2 e Toy Story 4", "g": "animation", "m": "lighthearted", "r": "L", "d": "modern", "o": "hollywood"},
    {"state": "Faroeste moderno de vinganca estilo Django Livre e Os Oito Odiados", "g": "western", "m": "intense", "r": "16", "d": "modern", "o": "hollywood"},
    {"state": "Guerra contemporanea recente e realista estilo 1917 e Nada de Novo no Front", "g": "war", "m": "intense", "r": "16", "d": "modern", "o": "hollywood"}
]

# Ampliação sintética equilibrada para alcançar alto volume de treino no Colab (~500+ exemplos)
dataset = []
random.seed(42)

for item in dataset_seed:
    dataset.append({
        "state": item["state"],
        "questions": extended_schema,
        "expected": {
            "genre": item["g"],
            "mood": item["m"],
            "content_rating": item["r"],
            "decade": item["d"],
            "origin": item["o"]
        }
    })

# Variações de linguagem e construções para garantir robustez
variations = [
    ("Indique um filme {o_desc} de {g_desc} dos {d_desc} bem {m_desc}.", {}),
    ("Quero assistir um filme {g_desc} estilo {o_desc} da epoca dos {d_desc}.", {}),
    ("Me recomende um filme dos {d_desc} {o_desc} com clima {m_desc}.", {}),
    ("Procurando filme {o_desc} {g_desc} para ver hoje à noite.", {}),
    ("Filme {d_desc} com {g_desc} e classificacao {r_desc}.", {})
]

genres_keys = list(extended_schema["genre"]["criteria"].keys())
moods_keys = list(extended_schema["mood"]["criteria"].keys())
decades_keys = list(extended_schema["decade"]["criteria"].keys())
origin_keys = list(extended_schema["origin"]["criteria"].keys())
ratings_keys = list(extended_schema["content_rating"]["criteria"].keys())

origin_labels = {
    "hollywood": "hollywoodiano americano em inglês",
    "korean": "coreano dorama da Coreia do Sul",
    "national": "brasileiro nacional do cinema do Brasil",
    "european": "europeu da Europa cult"
}

decade_labels = {
    "80s": "anos 80 clássico retrô oitentista",
    "90s": "anos 90 clássico noventista da década de 90",
    "2000s": "anos 2000 clássico dos 2000",
    "modern": "atual recente moderno dos últimos anos"
}

for _ in range(450):
    g = random.choice(genres_keys)
    m = random.choice(moods_keys)
    d = random.choice(decades_keys)
    o = random.choice(origin_keys)
    r = random.choice(ratings_keys)
    
    g_text = extended_schema["genre"]["criteria"][g].split(",")[0]
    m_text = extended_schema["mood"]["criteria"][m].split(",")[0]
    o_text = origin_labels[o]
    d_text = decade_labels[d]
    
    phrase = f"Quero um filme {o_text} de {g_text} dos {d_text} com clima {m_text} para maiores de {r} anos."
    
    dataset.append({
        "state": phrase,
        "questions": extended_schema,
        "expected": {
            "genre": g,
            "mood": m,
            "content_rating": r,
            "decade": d,
            "origin": o
        }
    })

random.shuffle(dataset)

os.makedirs("tmdb_recommender", exist_ok=True)

with open("tmdb_recommender/movie_questions.json", "w", encoding="utf-8") as f:
    json.dump(extended_schema, f, indent=2, ensure_ascii=False)

train_file = "tmdb_recommender/train_all_dimensions.jsonl"
with open(train_file, "w", encoding="utf-8") as f:
    for item in dataset:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print(f"Salvo dataset de 5 dimensoes com {len(dataset)} casos em {train_file}")
