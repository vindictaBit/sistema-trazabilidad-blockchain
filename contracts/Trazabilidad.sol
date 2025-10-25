// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Trazabilidad
 * @dev Smart Contract para sellar hashes de trazabilidad de medicamentos
 * @notice Este contrato permite registrar hashes de lotes de medicamentos de forma inmutable
 */
contract Trazabilidad {
    
    // Estructura para almacenar información del hash sellado
    struct RegistroHash {
        address emisor;
        string hash;
        uint256 timestamp;
        bool existe;
    }
    
    // Mapping para verificar si un hash ya fue registrado
    mapping(string => bool) public hashRegistrados;
    
    // Mapping para obtener detalles completos de un hash
    mapping(string => RegistroHash) public detallesHash;
    
    // Array para almacenar todos los hashes (útil para auditorías)
    string[] public todosLosHashes;
    
    // Evento emitido cuando se sella un hash
    event HashSellado(
        address indexed emisor, 
        string hash, 
        uint256 timestamp
    );
    
    /**
     * @dev Función principal para sellar un hash en la blockchain
     * @param _hash El hash SHA-256 del JSON del lote de medicamentos
     */
    function sellarHash(string memory _hash) public {
        // Validar que el hash no esté vacío
        require(bytes(_hash).length > 0, "El hash no puede estar vacio");
        
        // Validar que el hash no haya sido registrado previamente
        require(!hashRegistrados[_hash], "Este hash ya fue sellado previamente");
        
        // Marcar el hash como registrado
        hashRegistrados[_hash] = true;
        
        // Guardar detalles completos del registro
        detallesHash[_hash] = RegistroHash({
            emisor: msg.sender,
            hash: _hash,
            timestamp: block.timestamp,
            existe: true
        });
        
        // Agregar a la lista de todos los hashes
        todosLosHashes.push(_hash);
        
        // Emitir evento
        emit HashSellado(msg.sender, _hash, block.timestamp);
    }
    
    /**
     * @dev Verificar si un hash fue sellado
     * @param _hash El hash a verificar
     * @return bool True si el hash existe, False si no
     */
    function verificarHash(string memory _hash) public view returns (bool) {
        return hashRegistrados[_hash];
    }
    
    /**
     * @dev Obtener detalles completos de un hash sellado
     * @param _hash El hash a consultar
     * @return emisor La dirección que selló el hash
     * @return hash El hash sellado
     * @return timestamp El timestamp del sellado
     */
    function obtenerDetallesHash(string memory _hash) 
        public 
        view 
        returns (address emisor, string memory hash, uint256 timestamp) 
    {
        require(hashRegistrados[_hash], "Hash no encontrado");
        RegistroHash memory registro = detallesHash[_hash];
        return (registro.emisor, registro.hash, registro.timestamp);
    }
    
    /**
     * @dev Obtener el total de hashes sellados
     * @return uint256 Cantidad total de hashes
     */
    function totalHashesSellados() public view returns (uint256) {
        return todosLosHashes.length;
    }
    
    /**
     * @dev Obtener un hash por su índice
     * @param _indice El índice del hash en el array
     * @return string El hash en esa posición
     */
    function obtenerHashPorIndice(uint256 _indice) public view returns (string memory) {
        require(_indice < todosLosHashes.length, "Indice fuera de rango");
        return todosLosHashes[_indice];
    }
}
