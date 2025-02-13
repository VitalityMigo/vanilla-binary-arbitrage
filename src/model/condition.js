function binarySizing(Q_V, P_V, P_B, F) {
    return Math.ceil((Q_V * (P_V + F)) / (1 - P_B));
}

function arbCondition(DIR, Q_B, K_B, P_B, Q_V = 1, K_V, P_V, F) {
    if (DIR === 'Call') {
        return K_V <= K_B - Math.ceil((Q_V * (P_V + F)) / (1 - P_B))
    } else if (DIR === 'Put') {
        return K_V >= K_B + Math.ceil((Q_V * (P_V + F)) / (1 - P_B))
    }
}

module.exports = { arbCondition, binarySizing };