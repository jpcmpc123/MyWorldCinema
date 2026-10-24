import json

# Definição do esquema de decisão do recomendador
movie_schema = {
    "genre": {
        "type": "choice",
        "instructions": "Qual gênero principal melhor atende à preferência do usuário?",
        "criteria": {
            "action": "Ação, perseguição, lutas, adrenalina, explosões, heróis",
            "comedy": "Comédia, humor, risadas, piadas, diversão leve",
            "drama": "Drama, emoção profunda, conflitos familiares, dilemas humanos",
            "horror": "Terror, medo, sustos, suspense sombrio, criaturas, assombrações",
            "scifi": "Ficção científica, espaço, tecnologia, futuro, viagens no tempo",
            "romance": "Romance, histórias de amor, casais, paixão",
            "animation": "Animação, desenhos, filmes infantis e de fantasia animada"
        }
    },
    "mood": {
        "type": "choice",
        "instructions": "Qual é o humor/vibe buscado?",
        "criteria": {
            "lighthearted": "Leve, descontraído, divertido, relaxante para desestressar",
            "intense": "Tenso, eletrizante, adrenalina pura, acelerado, violento",
            "emotional": "Emocionante, tocante, de chorar, reflexivo",
            "dark": "Sombrio, perturbador, assustador, melancólico"
        }
    },
    "content_rating": {
        "type": "choice",
        "instructions": "Qual a classificação indicativa apropriada para este pedido?",
        "criteria": {
            "L": "Livre para todos os públicos, família, crianças",
            "12": "Recomendado para maiores de 12 ou 14 anos, aventura adolescente moderada",
            "16": "Para maiores de 16 ou 18 anos, conteúdo adulto, violência gráfica, terror pesado"
        }
    }
}

# Exemplos de treino em PT-BR e EN representando diferentes buscas de usuários
raw_examples = [
    # Ação / Aventura / Intenso
    {
        "state": "Quero um filme com tiroteio, perseguição de carro insana e pura adrenalina para sexta à noite.",
        "expected": {"genre": "action", "mood": "intense", "content_rating": "16"}
    },
    {
        "state": "Um filme de ação estilo John Wick com artes marciais violentas e vingança.",
        "expected": {"genre": "action", "mood": "intense", "content_rating": "16"}
    },
    {
        "state": "Aventura divertida de super-heróis para assistir com meu filho adolescente.",
        "expected": {"genre": "action", "mood": "lighthearted", "content_rating": "12"}
    },
    {
        "state": "Missão de resgate militar no meio da guerra com muito tiroteio realista.",
        "expected": {"genre": "action", "mood": "intense", "content_rating": "16"}
    },

    # Comédia / Leve
    {
        "state": "Preciso de um filme muito engraçado para rir e esquecer o estresse do trabalho.",
        "expected": {"genre": "comedy", "mood": "lighthearted", "content_rating": "12"}
    },
    {
        "state": "Uma comédia romântica leve e boba sobre encontros atrapalhados.",
        "expected": {"genre": "comedy", "mood": "lighthearted", "content_rating": "L"}
    },
    {
        "state": "Comédia escrachada com piadas pesadas para maiores e amigos bebendo cerveja.",
        "expected": {"genre": "comedy", "mood": "lighthearted", "content_rating": "16"}
    },
    {
        "state": "Paródia engraçada com humor pastelão para toda a família dar risada junta.",
        "expected": {"genre": "comedy", "mood": "lighthearted", "content_rating": "L"}
    },

    # Terror / Dark
    {
        "state": "Quero morrer de medo hoje, uma história de casa assombrada com demônios e espíritos.",
        "expected": {"genre": "horror", "mood": "dark", "content_rating": "16"}
    },
    {
        "state": "Terror psicológico tenso com monstros e suspense sufocante que não deixa dormir.",
        "expected": {"genre": "horror", "mood": "dark", "content_rating": "16"}
    },
    {
        "state": "Filme de terror slasher com assassino mascarado e mortes brutais.",
        "expected": {"genre": "horror", "mood": "intense", "content_rating": "16"}
    },
    {
        "state": "Suspense macabro com rituais sombrios e possessão demoníaca bem assustador.",
        "expected": {"genre": "horror", "mood": "dark", "content_rating": "16"}
    },

    # Ficção Científica (Sci-Fi)
    {
        "state": "Ficção científica no espaço sideral com exploração de buraco negro e viagens temporais.",
        "expected": {"genre": "scifi", "mood": "intense", "content_rating": "12"}
    },
    {
        "state": "Filme sobre inteligência artificial rebelde e distopia futurista cyberpunk.",
        "expected": {"genre": "scifi", "mood": "dark", "content_rating": "16"}
    },
    {
        "state": "Aventura espacial divertida com alienígenas amigáveis para ver com meus sobrinhos.",
        "expected": {"genre": "scifi", "mood": "lighthearted", "content_rating": "L"}
    },
    {
        "state": "Nave espacial isolada com tripulação lutando contra sobrevivência e mistério cósmico.",
        "expected": {"genre": "scifi", "mood": "intense", "content_rating": "12"}
    },

    # Drama / Emocionante
    {
        "state": "Um filme emocionante de chorar bastante, drama sobre superação familiar e perdas.",
        "expected": {"genre": "drama", "mood": "emotional", "content_rating": "12"}
    },
    {
        "state": "História real dramática com atuações profundas sobre julgamento ou injustiça social.",
        "expected": {"genre": "drama", "mood": "emotional", "content_rating": "12"}
    },
    {
        "state": "Drama pesado e melancólico sobre depressão e reconstrução de vida.",
        "expected": {"genre": "drama", "mood": "dark", "content_rating": "16"}
    },

    # Romance
    {
        "state": "Filme de romance aconchegante para assistir a dois debaixo das cobertas com chocolate.",
        "expected": {"genre": "romance", "mood": "emotional", "content_rating": "L"}
    },
    {
        "state": "Uma história de amor proibido entre duas pessoas de mundos diferentes bem tocante.",
        "expected": {"genre": "romance", "mood": "emotional", "content_rating": "12"}
    },
    {
        "state": "Romance picante e sensual com paixão ardente entre amantes.",
        "expected": {"genre": "romance", "mood": "intense", "content_rating": "16"}
    },

    # Animação / Infantil / Família
    {
        "state": "Desenho animado fofo e colorido para uma criança de 6 anos se divertir à tarde.",
        "expected": {"genre": "animation", "mood": "lighthearted", "content_rating": "L"}
    },
    {
        "state": "Animação mágica estilo Pixar com mensagem linda sobre família e amizade para ver juntos.",
        "expected": {"genre": "animation", "mood": "emotional", "content_rating": "L"}
    },
    {
        "state": "Filme de animação com animais falantes engraçados e aventura leve.",
        "expected": {"genre": "animation", "mood": "lighthearted", "content_rating": "L"}
    },
    {
        "state": "Animação japonesa com fantasia e jornada heroica para jovens.",
        "expected": {"genre": "animation", "mood": "intense", "content_rating": "12"}
    }
]

# Multiplica e cria variações para ter dados suficientes para o treino e calibração
dataset = []
for item in raw_examples:
    dataset.append({
        "state": item["state"],
        "questions": movie_schema,
        "expected": item["expected"]
    })

# Salva o arquivo de perguntas de inferência
with open("tmdb_recommender/movie_questions.json", "w", encoding="utf-8") as f:
    json.dump(movie_schema, f, indent=2, ensure_ascii=False)

# Salva o dataset JSONL
with open("tmdb_recommender/train_movies.jsonl", "w", encoding="utf-8") as f:
    for entry in dataset:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

print(f"Salvo {len(dataset)} casos em tmdb_recommender/train_movies.jsonl")
